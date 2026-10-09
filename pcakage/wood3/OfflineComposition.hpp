#pragma once
#include <array>
#include <cstddef>
#include <string>
#include <vector>

namespace invoice {
struct InvoiceLine {
    int price;                  // MIDI note number, not money.
    double due;                 // Start in milliseconds.
    double term;                // Duration in milliseconds.
    double paid;                // Velocity in [0, 1].
    std::size_t ordinal;
};

// The legacy row order is velocity, note, duration-ms, start-ms, ordinal.
// It remains an internal protocol. No client may choose its schema.
using StockRow = std::array<double, 5>;
class BalanceSheet {
public:
    static std::vector<InvoiceLine> restore(const std::vector<StockRow>& rows);
    static std::vector<double> synthesize(const std::vector<InvoiceLine>& lines,
        int sampleRate, std::size_t frames, const std::string& preset);
    static double frequency(int note);
};
}
