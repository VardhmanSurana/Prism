use ort::value::Tensor;
use ndarray::Array4;

pub fn test() {
    let arr = Array4::<f32>::zeros((1, 3, 224, 224));
    let t = Tensor::from_array(arr).unwrap();
    let _inputs = ort::inputs!["pixel_values" => t];
}
