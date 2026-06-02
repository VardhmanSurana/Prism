export type Point = { x: number; y: number };

/**
 * Creates a monotone cubic spline interpolation function.
 * This guarantees that the interpolated curve won't overshoot the control points,
 * which is critical for RGB curves (we don't want values dropping < 0 or > 255).
 * 
 * Assumes points are sorted by x in strictly increasing order.
 *
 * @param points Array of {x, y} anchor points
 * @returns A function `(x) => y` that evaluates the spline
 */
export function createMonotoneCubicSpline(points: Point[]): (x: number) => number {
  const n = points.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => points[0].y;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  // Array of secant slopes
  const dys = new Float64Array(n - 1);
  const dxs = new Float64Array(n - 1);
  const ms  = new Float64Array(n);

  // 1. Calculate secant lines
  for (let i = 0; i < n - 1; i++) {
    dxs[i] = xs[i + 1] - xs[i];
    dys[i] = (ys[i + 1] - ys[i]) / dxs[i];
  }

  // 2. Initialize tangents
  ms[0] = dys[0];
  for (let i = 1; i < n - 1; i++) {
    const m1 = dys[i - 1];
    const m2 = dys[i];
    if (m1 * m2 <= 0) {
      ms[i] = 0;
    } else {
      const dx1 = dxs[i - 1];
      const dx2 = dxs[i];
      const common = dx1 + dx2;
      ms[i] = 3 * common / ((common + dx2) / m1 + (common + dx1) / m2);
    }
  }
  ms[n - 1] = dys[n - 2];

  // 3. Return the evaluation function
  return (x: number): number => {
    // Handle bounds
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    // Find the interval
    // For small N (usually < 10 points for curves), linear search is fine.
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) {
      i++;
    }

    const h = dxs[i];
    if (h === 0) return ys[i];

    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 =  2 * t3 - 3 * t2 + 1;
    const h10 =  t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 =  t3 - t2;

    const y = h00 * ys[i] + h10 * h * ms[i] + h01 * ys[i + 1] + h11 * h * ms[i + 1];
    return y;
  };
}

/**
 * Samples a spline function `N` times to generate an array of Y values.
 * Useful for mapping 0-255 inputs to 0-255 outputs for image filtering.
 * 
 * @param evaluate The spline evaluation function
 * @param samples The number of points to sample (e.g. 256)
 * @returns Array of 256 evaluated y values
 */
export function generateLUT(evaluate: (x: number) => number, samples: number = 8): number[] {
  const lut = new Array(samples);
  // We assume the input points were given in [0, 1] range.
  // We will sample x from 0 to 1.
  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1);
    let y = evaluate(x);
    // Clamp to [0, 1] just in case
    y = Math.max(0, Math.min(1, y));
    lut[i] = y;
  }
  return lut;
}

/**
 * Composites two LUTs together (e.g. Red channel composed with Master channel).
 * Output = LUT2( LUT1(x) )
 */
export function compositeLUTs(lut1: number[], lut2: number[]): number[] {
  const samples = lut1.length;
  const result = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const val1 = lut1[i]; // value in [0, 1]
    
    // Map val1 into an index for lut2
    const indexFloat = val1 * (samples - 1);
    const index0 = Math.floor(indexFloat);
    const index1 = Math.min(samples - 1, index0 + 1);
    const t = indexFloat - index0;
    
    // Linear interpolate between lut2[index0] and lut2[index1]
    const val2 = lut2[index0] * (1 - t) + lut2[index1] * t;
    result[i] = val2;
  }
  return result;
}

/**
 * Given an array of points, creates an SVG path data string (d="...")
 * using cubic bezier curves to visually approximate the spline.
 * For true accuracy, we just sample the spline at many points and draw lines.
 */
export function splineToSvgPath(points: Point[], samples: number = 100): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  
  const evaluate = createMonotoneCubicSpline(points);
  let path = '';
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples; // 0 to 1
    // We assume points are scaled correctly. If points are 0-1, we evaluate in 0-1.
    // However, SVG rendering usually maps to pixel coordinates (e.g. 0-256).
    // The component will provide points already scaled to pixel coordinates.
    const minX = points[0].x;
    const maxX = points[points.length - 1].x;
    const x = minX + t * (maxX - minX);
    
    const y = evaluate(x);
    
    if (i === 0) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  
  return path;
}
