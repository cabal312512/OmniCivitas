using OmniCivitas.Mechanical;

namespace OmniCivitas.Workshop;

public readonly record struct ProbeDifferential(double Ax, double Ay, double Alpha)
{
    public double Acceleration => WorkshopProbeMath.Length(Ax, Ay);
}

public readonly record struct ProbeEnergyMetrics(double Speed, double Px, double Py, double Momentum, double LinearKinetic,
    double RotationalKinetic, double Potential, double TotalEnergy, double AngularMomentum);

public static class WorkshopProbeMath
{
    public static double Length(double x, double y)
    {
        if (!double.IsFinite(x) || !double.IsFinite(y)) return double.NaN;
        var largest = Math.Max(Math.Abs(x), Math.Abs(y));
        return largest == 0 ? 0 : largest * Math.Sqrt(x / largest * (x / largest) + y / largest * (y / largest));
    }

    public static double Inertia(MechanicalBody body)
    {
        if (body.Mode == "fixed") return 0;
        if (body.Mode != "dynamic" || !double.IsFinite(body.Mass) || body.Mass <= 0) return double.NaN;
        if (body.Kind is "ball" or "wheel" or "gear" or "pulley")
            return double.IsFinite(body.Radius) && body.Radius > 0 ? body.Mass * body.Radius * body.Radius / 2 : double.NaN;
        if (body.Kind is "box" or "track" or "link" or "slider")
            return double.IsFinite(body.Width) && double.IsFinite(body.Height) && body.Width > 0 && body.Height > 0
                ? body.Mass * (body.Width * body.Width + body.Height * body.Height) / 12 : double.NaN;
        return double.NaN;
    }

    public static ProbeEnergyMetrics Measure(double mass, double inertia, double x, double y, double vx, double vy, double omega, double gravityX, double gravityY)
    {
        var speed = Length(vx, vy); var px = mass * vx; var py = mass * vy;
        var linear = .5 * mass * speed * speed; var rotational = .5 * inertia * omega * omega;
        var potential = -mass * (gravityX * x + gravityY * y);
        return new(speed, px, py, Length(px, py), linear, rotational, potential, linear + rotational + potential, inertia * omega);
    }

    public static ProbeDifferential? Difference(double firstTime, double firstVx, double firstVy, double firstOmega,
        double secondTime, double secondVx, double secondVy, double secondOmega)
    {
        var dt = secondTime - firstTime;
        if (!double.IsFinite(dt) || dt <= 0) return null;
        var ax = (secondVx - firstVx) / dt; var ay = (secondVy - firstVy) / dt; var alpha = (secondOmega - firstOmega) / dt;
        return double.IsFinite(ax) && double.IsFinite(ay) && double.IsFinite(alpha) ? new(ax, ay, alpha) : null;
    }
}
