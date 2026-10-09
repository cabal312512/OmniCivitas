require 'digest'
require 'json'
require 'csv'
require_relative '../../config/2/4'

module OcvStock2
  class Receipt
    attr_reader :job, :source_digest, :kind

    def initialize(value)
      raise ArgumentError, 'The template envelope must be an object' unless value.is_a?(Hash)
      raise ArgumentError, 'Unsupported template contract' unless value['contract'] == Config::CONTRACT
      allowed = %w[contract job sourceDigest kind statistics manifest]
      raise ArgumentError, 'Unknown template envelope fields' unless (value.keys - allowed).empty?
      @job = Config.uuid(value['job'])
      @source_digest = Config.digest(value['sourceDigest'])
      @kind = Config.text(value['kind'], 'kind', 32)
      raise ArgumentError, 'No fixed report template exists for this source kind' unless Config::TEMPLATES.key?(@kind)
    end
  end

  class Common < Receipt
    def initialize(value)
      super
      @statistics = value.fetch('statistics', [])
      raise ArgumentError, 'Statistics must be an array of at most 4096 rows' unless @statistics.is_a?(Array) && @statistics.length <= 4096
      @selected = @statistics.first(Config::MAXIMUM_ROWS).map { |row| invoice(row) }
      @manifest = value['manifest']
      @manifest_check = @manifest.nil? ? nil : attest(@manifest)
    end

    def invoice(row)
      raise ArgumentError, 'A statistic row must be an object' unless row.is_a?(Hash)
      row.each_with_object({}) do |(key, value), output|
        next unless Config::FIXED_FIELDS.include?(key)
        unless value.nil? || value.is_a?(Numeric) || value.is_a?(String)
          raise ArgumentError, 'Statistic cells must be finite numbers, bounded text or null'
        end
        raise ArgumentError, 'A finite statistic is required' if value.is_a?(Float) && !value.finite?
        raise ArgumentError, 'Statistic text exceeds 128 bytes' if value.is_a?(String) && (value.bytesize > 128 || value.match?(/[\x00-\x1f]/))
        output[key] = value
      end
    end

    def attest(manifest)
      raise ArgumentError, 'The manifest must be an object' unless manifest.is_a?(Hash)
      raise ArgumentError, 'Unsupported manifest schema' unless manifest['schema'] == 'ocv.shared-manifest/1'
      raise ArgumentError, 'The manifest source digest differs' unless manifest['sourceDigest'] == source_digest
      raise ArgumentError, 'The manifest job differs' unless Config.uuid(manifest['job']) == job
      raise ArgumentError, 'The manifest source kind differs from the report template' unless manifest['kind'] == kind
      files = manifest['files']
      raise ArgumentError, 'Manifest entry count is unsupported' unless files.is_a?(Array) && files.length.between?(1, 23)
      names, unpacked = [], 0
      files.each do |file|
        raise ArgumentError, 'A manifest entry must be an object' unless file.is_a?(Hash)
        name = Config.text(file['name'], 'entry name', 128)
        fixed = %w[source.json results.json version.json compatibility.json]
        papers = %w[analysis.svg heatmap.svg samples.csv statistics.csv comparison.csv analysis.json].map { |paper| 'analysis/' + paper }
        raise ArgumentError, 'A manifest entry is outside the fixed path registry' unless (fixed + papers).include?(name)
        raise ArgumentError, 'Duplicate manifest paths are unsupported' if names.include?(name)
        names << name
        Config.digest(file['sha256'], 'entry sha256')
        bytes = file['bytes']
        raise ArgumentError, 'An entry byte count is unsupported' unless bytes.is_a?(Integer) && bytes.between?(0, 8 * 1024 * 1024)
        unpacked += bytes
      end
      raise ArgumentError, 'Manifest payload exceeds 8 MiB' if unpacked > 8 * 1024 * 1024
      { 'ok' => true, 'files' => files.length, 'unpackedBytes' => unpacked,
        'manifestSha256' => Digest::SHA256.hexdigest(Config.encode(manifest)),
        'scope' => 'fixed-path/schema/hash declaration attestation; archive byte readback belongs to C# and object storage' }
    end

    def convert
      fields = Config::FIXED_FIELDS.select { |field| @selected.any? { |row| row.key?(field) } }
      fields = %w[quantity unit count] if fields.empty?
      csv = CSV.generate(row_sep: "\n") do |writer|
        writer << fields
        @selected.each { |row| writer << fields.map { |field| Config.csv_cell(row[field]) } }
      end
      roundtrip = CSV.parse(csv, headers: true)
      raise ArgumentError, 'The legacy CSV conversion changed its header or row count' unless roundtrip.headers == fields && roundtrip.length == @selected.length
      fingerprint = Digest::SHA256.hexdigest(Config.encode(@selected))
      # The actual old receipt serializes JSON inside JSON before recovering the row identity.
      inside = Config.encode({ 'errorMessage' => Config.encode({ 'rows' => @selected, 'fingerprint' => fingerprint }) })
      receipt_csv = CSV.generate(row_sep: "\n") { |writer| writer << [job, inside] }
      restored_job, restored_inside = CSV.parse_line(receipt_csv)
      raise ArgumentError, 'The legacy position receipt changed the job identity' unless restored_job == job
      recovered = JSON.parse(JSON.parse(restored_inside)['errorMessage'])
      raise ArgumentError, 'The old receipt conversion changed the data fingerprint' unless recovered['fingerprint'] == fingerprint && recovered['rows'] == @selected
      { 'format' => 'ocv.report-csv/0', 'csv' => csv, 'sha256' => Digest::SHA256.hexdigest(csv),
        'bytes' => csv.bytesize, 'rows' => @selected.length, 'originalRows' => @statistics.length,
        'clipped' => @selected.length < @statistics.length, 'roundtripVerified' => true,
        'fingerprint' => fingerprint, 'nestedReceipt' => inside, 'receiptCsv' => receipt_csv }
    end

    def paper
      heading, scope = Config::TEMPLATES.fetch(kind)
      fields = Config::FIXED_FIELDS.select { |field| @selected.any? { |row| row.key?(field) } }
      fields = %w[quantity unit count] if fields.empty?
      headers = fields.map { |field| '<th>' + Config.escape(field) + '</th>' }.join
      rows = @selected.map do |row|
        '<tr>' + fields.map { |field| '<td>' + Config.escape(Config.price(row[field])) + '</td>' }.join + '</tr>'
      end.join
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">' \
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' \
        '<title>' + Config.escape(heading) + '</title><style>body{margin:24px;background:#f7fbff;color:#1e4b78;font:13px ui-monospace,monospace}' \
        'main{max-width:1200px;margin:auto}h1{font:600 24px system-ui}p{color:#627e99}table{border-collapse:collapse;width:100%;background:white}' \
        'th,td{border:1px solid #c4d8ed;padding:7px 10px;text-align:left}th{background:#edf5ff}code{overflow-wrap:anywhere}' \
        '.receipt{display:grid;grid-template-columns:120px 1fr;gap:6px;padding:12px;border:1px solid #afc9e4;margin:15px 0}' \
        '</style><main><h1>' + Config.escape(heading) + '</h1><p>' + Config.escape(scope) + '</p>' \
        '<div class="receipt"><span>Source</span><code>' + Config.escape(source_digest) + '</code><span>Task</span><code>' + Config.escape(job) + '</code>' \
        '<span>Rows</span><span>' + @selected.length.to_s + '/' + @statistics.length.to_s + '</span></div>' \
        '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table>' \
        '<p>Derived numerical inspection. The originating model and its documented limitations remain authoritative.</p></main></html>'
    end

    def restore
      loop do
        html = paper
        output = { 'ok' => true, 'contract' => Config::CONTRACT, 'job' => job, 'sourceDigest' => source_digest,
                   'kind' => kind, 'template' => kind + '/1', 'html' => html,
                   'sha256' => Digest::SHA256.hexdigest(html), 'bytes' => html.bytesize,
                   'legacy' => convert, 'attested' => true, 'manifestAttestation' => @manifest_check,
                   'selection' => { 'originalRows' => @statistics.length, 'selectedRows' => @selected.length,
                                    'clipped' => @selected.length < @statistics.length,
                                    'policy' => 'ordered prefix, at most 128 rows, halved until the 128 KiB output budget is met' },
                   'errorMessage' => 'template completed' }
        return output if Config.encode(output).bytesize <= Config::MAXIMUM_BYTES
        raise ArgumentError, 'A single fixed report row exceeds the 128 KiB output budget' if @selected.length <= 1
        @selected = @selected.first([1, @selected.length / 2].max)
      end
    end
  end

  module Common2
    def self.authorized?(received)
      key = ENV.fetch('OCV_RUNNER_KEY', '')
      return false if key.empty? || !received.is_a?(String) || received.bytesize > 512 || received.bytesize != key.bytesize
      received.bytes.zip(key.bytes).reduce(0) { |difference, (left, right)| difference | (left ^ right) }.zero?
    end

    def self.read(body)
      raw = body.read(2 * 1024 * 1024 + 1)
      raise ArgumentError, 'The template request exceeds 2 MiB' if raw.bytesize > 2 * 1024 * 1024
      Common.new(JSON.parse(raw, max_nesting: 48)).restore
    end
  end
end
