use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use hnsw_rs::prelude::*;
use parking_lot::RwLock;
use sqlx::{Row, SqlitePool};
use tracing::info;

use super::agent_search::decode_blob_to_f32_vec;

const EMBEDDING_DIM: usize = 768;
const MAX_NB_CONNECTION: usize = 16;
const MAX_LAYER: usize = 16;
const EF_CONSTRUCTION: usize = 200;
const DEFAULT_EF: usize = 100;

static VECTOR_INDEX: OnceLock<Arc<VectorIndex>> = OnceLock::new();

pub fn init_global(db: SqlitePool, data_dir: PathBuf) -> Arc<VectorIndex> {
    let vi = Arc::new(VectorIndex::new(db, data_dir));
    VECTOR_INDEX.get_or_init(|| vi.clone()).clone()
}

pub fn get_vector_index() -> Option<Arc<VectorIndex>> {
    VECTOR_INDEX.get().cloned()
}

pub struct VectorIndex {
    inner: Arc<RwLock<VectorInner>>,
    db: SqlitePool,
    #[allow(dead_code)]
    data_dir: PathBuf,
}

struct VectorInner {
    hnsw: Hnsw<'static, f32, DistCosine>,
    id_map: Vec<i64>,
}

impl VectorIndex {
    pub fn new(db: SqlitePool, data_dir: PathBuf) -> Self {
        let hnsw = Hnsw::<f32, DistCosine>::new(
            MAX_NB_CONNECTION,
            0,
            MAX_LAYER,
            EF_CONSTRUCTION,
            DistCosine {},
        );
        Self {
            inner: Arc::new(RwLock::new(VectorInner {
                hnsw,
                id_map: Vec::new(),
            })),
            db,
            data_dir,
        }
    }

    pub async fn init(&self) {
        self.rebuild_from_db().await;
    }

    pub async fn rebuild_from_db(&self) {
        info!("[VectorIndex] Rebuilding HNSW index from database...");
        let rows = sqlx::query(
            "SELECT id, embedding_blob FROM photos WHERE is_trash = 0 AND embedding_blob IS NOT NULL",
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let total = rows.len();
        let new_hnsw = Hnsw::<f32, DistCosine>::new(
            MAX_NB_CONNECTION,
            total.max(1),
            MAX_LAYER,
            EF_CONSTRUCTION,
            DistCosine {},
        );
        let mut new_id_map = Vec::with_capacity(total);

        for row in &rows {
            let photo_id: i64 = row.get("id");
            let blob: Option<Vec<u8>> = row.get("embedding_blob");
            if let Some(blob) = blob {
                let emb = decode_blob_to_f32_vec(&blob);
                if emb.len() == EMBEDDING_DIM {
                    let internal_id = new_id_map.len();
                    new_id_map.push(photo_id);
                    new_hnsw.insert((&emb, internal_id));
                }
            }
        }

        let loaded = new_id_map.len();
        {
            let mut w = self.inner.write();
            w.hnsw = new_hnsw;
            w.id_map = new_id_map;
        }
        info!(
            "[VectorIndex] Rebuilt with {} vectors (total rows with embeddings: {})",
            loaded, total
        );
    }

    pub fn insert(&self, photo_id: i64, embedding: &[f32]) {
        if embedding.len() != EMBEDDING_DIM {
            return;
        }
        let mut w = self.inner.write();
        let internal_id = w.id_map.len();
        w.id_map.push(photo_id);
        w.hnsw.insert((embedding, internal_id));
    }

    pub fn search(&self, query: &[f32], k: usize) -> Vec<(i64, f32)> {
        if query.len() != EMBEDDING_DIM {
            return vec![];
        }
        let r = self.inner.read();
        let nb = r.hnsw.get_nb_point();
        if nb == 0 {
            return vec![];
        }
        let neighbours = r.hnsw.search(query, k.min(nb), DEFAULT_EF);
        neighbours
            .iter()
            .filter_map(|n| {
                let photo_id = *r.id_map.get(n.d_id)?;
                Some((photo_id, n.distance))
            })
            .collect()
    }

    pub fn is_loaded(&self) -> bool {
        self.inner.read().hnsw.get_nb_point() > 0
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.inner.read().hnsw.get_nb_point()
    }
}
