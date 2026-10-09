<?php
namespace Ocv\Stock2;

final class Config {
    public const CONTRACT = 'ocv.shared-artifact/1';
    public const INPUT_BYTES = 1048576;
    public const MANIFEST_BYTES = 262144;
    public const COMPATIBILITY_BYTES = 131072;
    public const RETENTION = 64;
    public const KINDS = ['mechanical','circuit','communication','digital','network','music','table'];
    public const PATHS = ['source.json','results.json','version.json','compatibility.json','analysis/analysis.svg','analysis/heatmap.svg','analysis/samples.csv','analysis/statistics.csv','analysis/comparison.csv','analysis/analysis.json'];

    public static function text(mixed $value, string $name, int $maximum = 128): string {
        if (!is_string($value) || strlen($value) < 1 || strlen($value) > $maximum || preg_match('/[\x00-\x1f]/', $value)) {
            throw new \InvalidArgumentException($name.' must be bounded text');
        }
        return $value;
    }

    public static function uuid(mixed $value): string {
        $value = self::text($value, 'job', 36);
        if (!preg_match('/\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\z/', $value)) {
            throw new \InvalidArgumentException('job must be a UUID');
        }
        return strtolower($value);
    }

    public static function digest(mixed $value, string $name): string {
        if (!is_string($value) || !preg_match('/\A[0-9a-f]{64}\z/', $value)) throw new \InvalidArgumentException($name.' must be a lowercase SHA256');
        return $value;
    }

    public static function shape(array $value, array $allowed): void {
        if (array_diff(array_keys($value), $allowed)) throw new \InvalidArgumentException('Unknown catalog envelope fields');
    }

    public static function canonical(mixed $value): mixed {
        if (!is_array($value)) return $value;
        if (array_is_list($value)) return array_map([self::class, 'canonical'], $value);
        ksort($value, SORT_STRING);
        foreach ($value as $key => $item) $value[$key] = self::canonical($item);
        return $value;
    }

    public static function encode(mixed $value): string {
        return json_encode(self::canonical($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
    }

    public static function authorized(?string $received): bool {
        $key = getenv('OCV_RUNNER_KEY') ?: '';
        return $key !== '' && is_string($received) && strlen($received) <= 512 && hash_equals($key, $received);
    }

    public static function read(array $value): string {
        self::shape($value, ['contract','job']);
        if (($value['contract'] ?? null) !== self::CONTRACT) throw new \InvalidArgumentException('Unsupported catalog contract');
        return self::uuid($value['job'] ?? null);
    }

    public static function delete(array $value): array {
        self::shape($value, ['contract','job','sourceDigest','archiveSha','bytes','objectKey','manifest','compatibility']);
        if (($value['contract'] ?? null) !== self::CONTRACT) throw new \InvalidArgumentException('Unsupported catalog contract');
        $job = self::uuid($value['job'] ?? null);
        $source = self::digest($value['sourceDigest'] ?? null, 'sourceDigest');
        $archive = self::digest($value['archiveSha'] ?? null, 'archiveSha');
        $bytes = $value['bytes'] ?? null;
        if (!is_int($bytes) || $bytes < 1 || $bytes > 3*1024*1024) throw new \InvalidArgumentException('Archive byte count is outside the bounded range');
        $objectKey = self::text($value['objectKey'] ?? null, 'objectKey', 160);
        if ($objectKey !== 'shared/'.$job.'/'.$archive.'.zip') throw new \InvalidArgumentException('The object key differs from the fixed archive path');
        $manifest = $value['manifest'] ?? null;
        if (!is_array($manifest) || array_is_list($manifest) || strlen(self::encode($manifest)) > self::MANIFEST_BYTES) {
            throw new \InvalidArgumentException('A bounded manifest object is required');
        }
        if (($manifest['schema'] ?? null) !== 'ocv.shared-manifest/1' || ($manifest['contract'] ?? null) !== self::CONTRACT ||
            self::uuid($manifest['job'] ?? null) !== $job || ($manifest['sourceDigest'] ?? null) !== $source || !in_array($manifest['kind'] ?? null, self::KINDS, true)) {
            throw new \InvalidArgumentException('The immutable manifest provenance differs');
        }
        $entries = $manifest['files'] ?? null;
        if (!is_array($entries) || !array_is_list($entries) || count($entries) < 1 || count($entries) > 23) throw new \InvalidArgumentException('A bounded manifest entry list is required');
        $names = []; $unpacked = 0;
        foreach ($entries as $entry) {
            if (!is_array($entry)) throw new \InvalidArgumentException('An entry must be an object');
            $name = self::text($entry['name'] ?? null, 'entry path');
            if (!in_array($name, self::PATHS, true) || in_array($name, $names, true)) throw new \InvalidArgumentException('Manifest paths are duplicate or outside the fixed registry');
            $names[] = $name;
            self::digest($entry['sha256'] ?? null, 'entry checksum');
            if (!is_int($entry['bytes'] ?? null) || $entry['bytes'] < 0 || $entry['bytes'] > 8*1024*1024) throw new \InvalidArgumentException('Entry bytes are outside the bounded range');
            $unpacked += $entry['bytes'];
        }
        if ($unpacked > 8*1024*1024) throw new \InvalidArgumentException('Declared unpacked bytes exceed 8 MiB');
        $compatibility = $value['compatibility'] ?? null;
        if (!is_array($compatibility) || array_is_list($compatibility) || strlen(self::encode($compatibility)) > self::COMPATIBILITY_BYTES ||
            ($compatibility['ok'] ?? null) !== true || ($compatibility['contract'] ?? null) !== self::CONTRACT ||
            ($compatibility['sourceDigest'] ?? null) !== $source || self::uuid($compatibility['job'] ?? null) !== $job ||
            ($compatibility['attested'] ?? null) !== true) throw new \InvalidArgumentException('A matching fixed-template compatibility receipt is required');
        $template = self::text($compatibility['template'] ?? null, 'template', 48);
        if ($template !== $manifest['kind'].'/1') throw new \InvalidArgumentException('The fixed template kind differs from the manifest');
        if (isset($compatibility['html'])) {
            $html = self::text($compatibility['html'], 'HTML', self::COMPATIBILITY_BYTES);
            if (self::digest($compatibility['sha256'] ?? null, 'HTML checksum') !== hash('sha256', $html)) throw new \InvalidArgumentException('Fixed-template HTML checksum differs');
        }
        return ['contract'=>self::CONTRACT,'job'=>$job,'sourceDigest'=>$source,'archiveSha'=>$archive,'bytes'=>$bytes,
                'objectKey'=>$objectKey,'manifest'=>$manifest,'compatibility'=>$compatibility,'template'=>$template,
                'unpackedBytes'=>$unpacked,'manifestSha256'=>hash('sha256',self::encode($manifest))];
    }

    public static function page(array $publication, array $manifest): string {
        $escape = fn(mixed $value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $rows = '';
        foreach ($manifest['files'] as $entry) $rows .= '<tr><td>'.$escape($entry['name']).'</td><td>'.$escape($entry['bytes']).'</td><td><code>'.$escape($entry['sha256']).'</code></td></tr>';
        return '<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">'.
            '<title>Artifact record</title><style>body{font:13px ui-monospace,monospace;background:#f8fbff;color:#27537d;margin:24px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:8px;border:1px solid #bed3e8;text-align:left}code{overflow-wrap:anywhere}h1{font:600 24px system-ui}</style>'.
            '<h1>Artifact record</h1><p>'.$escape($publication['template']).' · '.$escape($publication['publishedAt']).'</p><p><code>'.$escape($publication['sha256']).'</code></p>'.
            '<table><thead><tr><th>Path</th><th>Bytes</th><th>SHA256</th></tr></thead><tbody>'.$rows.'</tbody></table></html>';
    }
}
