#include "OfflineComposition.hpp"
#include "config/8/RenderPolicy.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace invoice {
double BalanceSheet::frequency(int note) { return 440.0 * std::exp2((note - 69) / 12.0); }

std::vector<InvoiceLine> BalanceSheet::restore(const std::vector<StockRow>& rows) {
    std::vector<InvoiceLine> lines;
    lines.reserve(rows.size());
    for (const auto& row : rows) {
        if (row[0] < 0 || row[0] > 1 || row[1] < 0 || row[1] > 127 ||
            row[2] < 10 || row[3] < 0 || row[2] + row[3] > stock8::Common::durationMs ||
            std::floor(row[1]) != row[1] || row[4] < 0 || row[4] >= stock8::Common::notes)
            throw std::invalid_argument("legacy stock row cannot restore a valid note");
        lines.push_back({static_cast<int>(row[1]), row[3], row[2], row[0], static_cast<std::size_t>(row[4])});
    }
    std::stable_sort(lines.begin(), lines.end(), [](const auto& a, const auto& b) {
        return a.due == b.due ? a.ordinal < b.ordinal : a.due < b.due;
    });
    return lines;
}

std::vector<double> BalanceSheet::synthesize(const std::vector<InvoiceLine>& lines,
    int rate, std::size_t frames, const std::string& preset) {
    std::vector<double> samples(frames, 0);
    for (const auto& line : lines) {
        const auto first = static_cast<std::size_t>(std::llround(line.due * rate / 1000.0));
        const auto last = std::min(frames, static_cast<std::size_t>(std::llround((line.due + line.term) * rate / 1000.0)));
        if (line.paid == 0 || first >= last) continue;
        const double hz = frequency(line.price);
        const double noteSeconds = static_cast<double>(last - first) / rate;
        const double attack = std::min(0.005, noteSeconds * 0.2);
        const double release = std::min(0.04, noteSeconds * 0.3);
        for (std::size_t index = first; index < last; ++index) {
            const double time = static_cast<double>(index - first) / rate;
            const double phase = stock8::Common::tau * hz * time;
            double value = 0;
            if (preset == "sine") value = std::sin(phase);
            else if (preset == "triangle") {
                for (int harmonic = 1; harmonic <= 15 && hz * harmonic < rate * 0.45; harmonic += 2) {
                    const double sign = harmonic % 4 == 1 ? 1.0 : -1.0;
                    value += sign * std::sin(phase * harmonic) / (harmonic * harmonic);
                }
                value *= 8.0 / (3.14159265358979323846 * 3.14159265358979323846);
            } else {
                value = std::sin(phase) * std::exp(-3.0 * time);
                if (hz * 2.01 < rate * 0.45) value += 0.45 * std::sin(phase * 2.01) * std::exp(-5.0 * time);
                if (hz * 3.98 < rate * 0.45) value += 0.2 * std::sin(phase * 3.98) * std::exp(-8.0 * time);
                value /= 1.65;
            }
            const double envelope = std::min(1.0, time / attack) * std::min(1.0, (noteSeconds - time) / release);
            samples[index] += value * envelope * line.paid;
        }
    }
    return samples;
}
}
