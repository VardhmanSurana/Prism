use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};
use tracing::{debug, info, warn};

pub const BEACON_PORT: u16 = 8272;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiscoveredPeer {
    pub peer_id: String,
    pub hostname: String,
    pub device_type: String,
    pub ip: String,
    pub port: u16,
    pub last_seen: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
struct BeaconPacket {
    #[serde(rename = "type")]
    packet_type: String,
    peer_id: String,
    hostname: String,
    device_type: String,
    port: u16,
    version: String,
}

pub struct LanBeaconService {
    local_peer_id: String,
    hostname: String,
    device_type: String,
    service_port: u16,
    peers: Arc<RwLock<HashMap<String, DiscoveredPeer>>>,
}

impl LanBeaconService {
    pub fn new(local_peer_id: String, service_port: u16) -> Self {
        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "Prism-Device".to_string());
        let device_type = "desktop".to_string();

        Self {
            local_peer_id,
            hostname,
            device_type,
            service_port,
            peers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Returns non-loopback local LAN IP address
    pub fn get_local_ip(&self) -> String {
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    let ip = addr.ip();
                    if !ip.is_loopback() {
                        return ip.to_string();
                    }
                }
            }
        }
        "127.0.0.1".to_string()
    }

    /// Returns active peers seen in the last 10 seconds, excluding self
    pub async fn get_nearby_peers(&self) -> Vec<DiscoveredPeer> {
        let now = Utc::now();
        let mut peers_lock = self.peers.write().await;
        // Prune expired peers (> 10s)
        peers_lock.retain(|_, p| (now - p.last_seen).num_seconds() <= 10);

        peers_lock
            .values()
            .filter(|p| p.peer_id != self.local_peer_id)
            .cloned()
            .collect()
    }

    /// Spawns background transmitter and receiver loops
    pub fn start(self: &Arc<Self>) {
        let svc = Arc::clone(self);
        tokio::spawn(async move {
            svc.run_receiver().await;
        });

        let svc2 = Arc::clone(self);
        tokio::spawn(async move {
            svc2.run_broadcaster().await;
        });
    }

    async fn run_broadcaster(&self) {
        let socket = match tokio::net::UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                warn!("LAN beacon transmitter bind error: {}", e);
                return;
            }
        };

        if let Err(e) = socket.set_broadcast(true) {
            warn!("Failed to enable broadcast on LAN beacon socket: {}", e);
        }

        let target: SocketAddr = format!("255.255.255.255:{}", BEACON_PORT)
            .parse()
            .unwrap();

        loop {
            let packet = BeaconPacket {
                packet_type: "prism_beacon".to_string(),
                peer_id: self.local_peer_id.clone(),
                hostname: self.hostname.clone(),
                device_type: self.device_type.clone(),
                port: self.service_port,
                version: "0.1.0".to_string(),
            };

            if let Ok(payload) = serde_json::to_vec(&packet) {
                let _ = socket.send_to(&payload, target).await;
            }

            sleep(Duration::from_secs(3)).await;
        }
    }

    async fn run_receiver(&self) {
        let bind_addr: SocketAddr = format!("0.0.0.0:{}", BEACON_PORT).parse().unwrap();
        let socket = match tokio::net::UdpSocket::bind(bind_addr).await {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to bind LAN beacon receiver on port {}: {}. Multi-instance UDP discovery disabled.", BEACON_PORT, e);
                return;
            }
        };

        info!("LAN discovery beacon listening on UDP port {}", BEACON_PORT);

        let mut buf = [0u8; 2048];
        loop {
            match socket.recv_from(&mut buf).await {
                Ok((len, src_addr)) => {
                    if let Ok(packet) = serde_json::from_slice::<BeaconPacket>(&buf[..len]) {
                        if packet.packet_type == "prism_beacon" && packet.peer_id != self.local_peer_id {
                            let peer = DiscoveredPeer {
                                peer_id: packet.peer_id.clone(),
                                hostname: packet.hostname,
                                device_type: packet.device_type,
                                ip: src_addr.ip().to_string(),
                                port: packet.port,
                                last_seen: Utc::now(),
                            };

                            let mut lock = self.peers.write().await;
                            lock.insert(packet.peer_id, peer);
                        }
                    }
                }
                Err(e) => {
                    debug!("Error receiving LAN beacon: {}", e);
                }
            }
        }
    }
}
