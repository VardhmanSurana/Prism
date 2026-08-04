import os
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from PIL import Image

from app.services.vision_pipeline import clean_tags, extract_features_and_tags

TEST_IMAGES = [
    "/home/chotaxdon/Pictures/1_Hp_v3Cp10iZfqroG9MOgpw.webp",
    "/home/chotaxdon/Pictures/NameBright - Domain Expired.jpeg",
]

def test_clean_tags():
    # Basic deduplication and cleaning
    labels = ["dog", "cat", "Person", "sky!", ""]
    caption = "A happy family with a black dog standing on a sandy beach."
    tags = clean_tags(labels, caption)
    
    # "dog" and "person" are in labels.
    # "happy", "family", "black", "standing", "sandy", "beach" are in caption.
    assert "dog" in tags
    assert "cat" in tags
    assert "person" in tags
    assert "sky" in tags
    assert "family" in tags
    assert "beach" in tags
    assert "sandy" in tags
    assert "happy" in tags
    # Stop words should be removed
    assert "a" not in tags
    assert "with" not in tags
    assert "on" not in tags

def test_extract_features_and_tags_file_not_found():
    with pytest.raises(FileNotFoundError):
        extract_features_and_tags("/nonexistent/file.jpg")

@patch("app.services.image_summary.llm.generate_ollama_summary")
@patch("app.services.image_summary.llm.generate_tags_json")
@patch("app.services.vision_pipeline._get_siglip")
@patch("PIL.Image.open")
def test_extract_features_and_tags_mocked(mock_image_open, mock_get_siglip, mock_generate_tags_json, mock_generate_ollama_summary):
    # Mock PIL Image
    mock_image = MagicMock(spec=Image.Image)
    mock_image.width = 800
    mock_image.height = 600
    mock_image_open.return_value = mock_image

    # Mock generated outputs for Gemma 4 E2B Vision
    mock_generate_ollama_summary.return_value = "A cute cat sleeping on a sofa."
    mock_generate_tags_json.return_value = ["cat", "sofa"]
    
    # Mock SigLIP model and processor
    mock_siglip_model = MagicMock()
    mock_siglip_processor = MagicMock()
    mock_siglip_processor.return_value = {
        "pixel_values": MagicMock()
    }
    mock_get_siglip.return_value = (mock_siglip_model, mock_siglip_processor)
    
    # Mock SigLIP features return
    mock_features = MagicMock()
    mock_features.shape = (1, 768)
    mock_features.pooler_output = mock_features
    mock_features.norm.return_value = mock_features
    mock_features.__truediv__.return_value = mock_features
    # We want features[0].cpu().numpy().tolist() to return a mock vector
    mock_features.__getitem__.return_value.cpu.return_value.numpy.return_value.tolist.return_value = [0.1] * 768
    mock_siglip_model.get_image_features.return_value = mock_features

    # Run extraction
    result = extract_features_and_tags(TEST_IMAGES[0])
    
    assert "caption" in result
    assert "detailed_caption" in result
    assert "tags" in result
    assert "embedding" in result
    
    assert result["caption"] == "A cute cat sleeping on a sofa."
    assert "cat" in result["tags"]
    assert "sofa" in result["tags"]
    assert len(result["embedding"]) == 768

# Live test (skipped by default)
@pytest.mark.skipif(
    not os.environ.get("RUN_LIVE_VISION_TESTS"),
    reason="Set RUN_LIVE_VISION_TESTS=1 to run against live Florence/SigLIP models",
)
def test_integration_live_vision_pipeline():
    """Requires actual Florence-2 and SigLIP2 models to be downloaded and CUDA/CPU resources."""
    test_img = TEST_IMAGES[0]
    result = extract_features_and_tags(test_img)
    
    assert "caption" in result
    assert len(result["caption"]) > 0
    assert "tags" in result
    assert isinstance(result["tags"], list)
    assert "embedding" in result
    assert len(result["embedding"]) == 768
