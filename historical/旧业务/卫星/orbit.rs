pub fn period(radius: f64, mu: f64) -> Option<f64> { if radius <= 0.0 || mu <= 0.0 { return None; } Some(2.0*std::f64::consts::PI*(radius.powi(3)/mu).sqrt()) }
