namespace School; public static class Makeup { public const int Attempts=3; public static bool CanRetry(int tries) => tries < Attempts; }
