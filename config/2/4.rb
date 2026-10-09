require 'csv'
require 'cgi'
require 'digest'
require 'json'

module OcvStock2
  module Config
    CONTRACT = 'ocv.shared-artifact/1'.freeze
    MAXIMUM_BYTES = 131_072
    MAXIMUM_ROWS = 128
    FIXED_FIELDS = %w[entity quantity unit axisUnit count min max mean stddev median p05 p95 rms sum first last].freeze
    TEMPLATES = {
      'mechanical' => ['Mechanical trajectory record', 'Observed rigid-body state cells and derived numerical summaries. Scan outcomes distinguish completed and retained failed trials; failed-trial measurements are diagnostic records, not successful physical solutions.'],
      'circuit' => ['Circuit analysis record', 'Sampled node voltages and branch currents; explicit units accompany each channel.'],
      'communication' => ['Communication sample record', 'Recorded baseband samples; no new modulation or physical-channel claim.'],
      'digital' => ['Ideal digital timing record', 'Recorded boolean wire states at sampled times in seconds. Numeric 0/1 encodes logical false/true for inspection, not analog voltage. Ideal synchronous timing excludes propagation delay, setup/hold and metastability; no new simulation is performed.'],
      'network' => ['Packet observation record', 'Observed finite packet events and reported flow quantities; unfinished packets remain unfinished.'],
      'music' => ['Submitted note record', 'Explicitly submitted MIDI-note parameters; this report does not process recorded audio.'],
      'table' => ['Submitted numerical table', 'Bounded numerical cells from a deliberately submitted table.']
    }.freeze

    def self.text(value, name, maximum = 128)
      raise ArgumentError, "#{name} must be a bounded string" unless value.is_a?(String) && value.bytesize.between?(1, maximum) && !value.match?(/[\x00-\x1f]/)
      value
    end

    def self.digest(value, name = 'sourceDigest')
      raise ArgumentError, "#{name} must be a lowercase SHA256" unless value.is_a?(String) && value.match?(/\A[0-9a-f]{64}\z/)
      value
    end

    def self.uuid(value, name = 'job')
      raise ArgumentError, "#{name} must be a UUID" unless value.is_a?(String) && value.match?(/\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\z/)
      value.downcase
    end

    def self.canonical(value)
      case value
      when Hash then value.keys.sort.each_with_object({}) { |key, output| output[key] = canonical(value[key]) }
      when Array then value.map { |item| canonical(item) }
      when Float
        raise ArgumentError, 'A finite statistic is required' unless value.finite?
        value
      else value
      end
    end

    def self.encode(value)
      JSON.generate(canonical(value))
    end

    def self.escape(value)
      CGI.escapeHTML(value.nil? ? '—' : value.to_s)
    end

    def self.csv_cell(value)
      return "'#{value}" if value.is_a?(String) && value.match?(/\A[=+\-@\t\r]/)
      value
    end

    def self.price(value)
      return '—' if value.nil?
      return format('%.8g', value) if value.is_a?(Numeric)
      value.to_s
    end
  end
end
