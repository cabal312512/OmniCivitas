using System;
using OmniCivitas.Mechanical;
using OmniCivitas.Workshop;

internal static class WorkshopProbeFocusedCheck
{
    private static int checks;

    private static void Near(string name, double actual, double expected, double tolerance = 1e-11)
    {
        if (!double.IsFinite(actual) || Math.Abs(actual - expected) > tolerance * Math.Max(Math.Abs(expected), 1e-250))
            throw new InvalidOperationException($"{name}: expected {expected:R}, received {actual:R}");
        checks++;
    }

    private static void True(string name, bool value)
    {
        if (!value) throw new InvalidOperationException(name);
        checks++;
    }

    private static int Main()
    {
        Near("rectangle inertia", WorkshopProbeMath.Inertia(new MechanicalBody { Kind = "box", Mass = 12, Width = 4, Height = 3 }), 25);
        Near("circle inertia", WorkshopProbeMath.Inertia(new MechanicalBody { Kind = "ball", Mass = 8, Radius = 2 }), 16);
        Near("wheel follows circle collider", WorkshopProbeMath.Inertia(new MechanicalBody { Kind = "wheel", Mass = 8, Radius = 2 }), 16);
        Near("link follows rectangle collider", WorkshopProbeMath.Inertia(new MechanicalBody { Kind = "link", Mass = 3, Width = 3, Height = 1 }), 2.5);
        Near("fixed inertia", WorkshopProbeMath.Inertia(new MechanicalBody { Mode = "fixed", Mass = 8, Radius = 2 }), 0);
        True("unsupported inertia unavailable", double.IsNaN(WorkshopProbeMath.Inertia(new MechanicalBody { Kind = "unsupported" })));
        var energy = WorkshopProbeMath.Measure(2, 5, 3, 4, 3, 4, 2, 1, -10);
        Near("speed", energy.Speed, 5); Near("px", energy.Px, 6); Near("py", energy.Py, 8);
        Near("momentum", energy.Momentum, 10); Near("linear kinetic", energy.LinearKinetic, 25);
        Near("rotational kinetic", energy.RotationalKinetic, 10); Near("gravity dot potential", energy.Potential, 74);
        Near("total energy", energy.TotalEnergy, 109); Near("angular momentum", energy.AngularMomentum, 10);
        var derivative = WorkshopProbeMath.Difference(.1, 1, -2, 3, .35, 6, 3, -2)
            ?? throw new InvalidOperationException("Nonuniform actual sample times rejected.");
        Near("actual dt ax", derivative.Ax, 20); Near("actual dt ay", derivative.Ay, 20);
        Near("actual dt alpha", derivative.Alpha, -20); Near("acceleration norm", derivative.Acceleration, 20 * Math.Sqrt(2));
        True("zero dt unavailable", WorkshopProbeMath.Difference(1, 0, 0, 0, 1, 1, 1, 1) is null);
        True("negative dt unavailable", WorkshopProbeMath.Difference(2, 0, 0, 0, 1, 1, 1, 1) is null);
        True("nonfinite sample unavailable", WorkshopProbeMath.Difference(0, double.NaN, 0, 0, 1, 1, 1, 1) is null);
        Near("large norm avoids intermediate overflow", WorkshopProbeMath.Length(1e200, 2e200), Math.Sqrt(5) * 1e200);
        Near("small norm avoids square underflow", WorkshopProbeMath.Length(1e-200, 3e-200), Math.Sqrt(10) * 1e-200);
        Console.WriteLine($"Workshop probe numerical checks passed: {checks}");
        return 0;
    }
}
