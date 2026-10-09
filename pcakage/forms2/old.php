<?php
namespace Ocv\Stock2\Invoice;

use Ocv\Stock2\Config;
use PDO;

final class Common2 {
    private PDO $data;
    private bool $closed = true;

    public function __construct(PDO $data) {
        if ($data->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql') throw new \RuntimeException('The shared publication catalog requires actual MySQL');
        $this->data = $data;
    }

    private function schema(): void {
        $this->data->exec('CREATE TABLE IF NOT EXISTS ocv_tax_coupons2 (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,root_id CHAR(36) NOT NULL UNIQUE,invoice_sha CHAR(64) NOT NULL,source_sha CHAR(64) NOT NULL,paper_sha CHAR(64) NOT NULL,prices INT UNSIGNED NOT NULL,revision INT UNSIGNED NOT NULL,created_ms BIGINT UNSIGNED NOT NULL,created_at DATETIME(3) NOT NULL) ENGINE=InnoDB');
        $this->data->exec('CREATE TABLE IF NOT EXISTS ocv_loan_items2 (coupon_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,stock_json MEDIUMTEXT NOT NULL,decoration MEDIUMTEXT NOT NULL,CONSTRAINT ocv_loan_coupon2 FOREIGN KEY(coupon_id) REFERENCES ocv_tax_coupons2(id) ON DELETE CASCADE) ENGINE=InnoDB');
        $this->data->exec('CREATE OR REPLACE VIEW ocv_tax_statement2 AS SELECT c.id,c.root_id,c.invoice_sha,c.source_sha,c.paper_sha,c.prices,c.revision,c.created_ms,c.created_at,s.stock_json,s.decoration FROM ocv_tax_coupons2 c JOIN ocv_loan_items2 s ON s.coupon_id=c.id');
    }

    private function select(string $job): ?array {
        $query = $this->data->prepare('SELECT * FROM ocv_tax_statement2 WHERE root_id=? LIMIT 1');
        $query->execute([$job]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function format(array $row, bool $repeated): array {
        $manifest = json_decode($row['stock_json'], true, 48, JSON_THROW_ON_ERROR);
        $metadata = json_decode($row['decoration'], true, 48, JSON_THROW_ON_ERROR);
        if (hash('sha256', Config::encode($manifest)) !== $metadata['manifestSha256'] || $metadata['archiveSha'] !== $row['paper_sha']) throw new \RuntimeException('The joined catalog receipt failed checksum readback');
        $publication = ['id'=>(int)$row['id'],'revision'=>(int)$row['revision'],'sha256'=>$row['paper_sha'],
                        'publishedAt'=>$row['created_at'].'Z','unixMilliseconds'=>(int)$row['created_ms'],
                        'template'=>$metadata['template'],'objectKey'=>$metadata['objectKey'],'bytes'=>(int)$row['prices'],
                        'manifestSha256'=>$metadata['manifestSha256']];
        return ['ok'=>true,'contract'=>Config::CONTRACT,'job'=>$row['root_id'],'sourceDigest'=>$row['source_sha'],
                'publication'=>$publication,'page'=>Config::page($publication,$manifest),'manifest'=>$manifest,
                'storage'=>'mysql','authority'=>'derived publication catalog; original source version remains PostgreSQL authority',
                'readbackVerified'=>true,'repeated'=>$repeated,'retention'=>Config::RETENTION,'tables'=>2,
                'errorMessage'=>'publication completed'];
    }

    private function open(): void {
        $statement = $this->data->query("SELECT GET_LOCK('ocv_sh4_catalog2',5)");
        if ((int)$statement->fetchColumn() !== 1) throw new \RuntimeException('The bounded publication catalog is busy');
        $this->closed = false;
        $this->schema();
    }

    private function close(): void {
        if (!$this->closed) {
            $this->data->query("SELECT RELEASE_LOCK('ocv_sh4_catalog2')");
            $this->closed = true;
        }
    }

    public function restore(string $job): ?array {
        try {
            $this->open();
            $row = $this->select($job);
            return $row === null ? null : $this->format($row,true);
        } finally { $this->close(); }
    }

    public function delete(array $invoice): array {
        $fingerprint = hash('sha256', Config::encode($invoice));
        try {
            $this->open();
            $this->data->beginTransaction();
            $previous = $this->select($invoice['job']);
            if ($previous !== null) {
                if (!hash_equals($previous['invoice_sha'],$fingerprint)) throw new \LogicException('The immutable publication job already contains different data');
                $result = $this->format($previous,true);
                $this->data->commit();
                return $result;
            }
            $clock = new \DateTimeImmutable('now',new \DateTimeZone('UTC'));
            $milliseconds = (int)$clock->format('Uv');
            $statement = $this->data->prepare('INSERT INTO ocv_tax_coupons2(root_id,invoice_sha,source_sha,paper_sha,prices,revision,created_ms,created_at) VALUES(?,?,?,?,?,1,?,?)');
            $statement->execute([$invoice['job'],$fingerprint,$invoice['sourceDigest'],$invoice['archiveSha'],$invoice['bytes'],$milliseconds,$clock->format('Y-m-d H:i:s.v')]);
            $id = (int)$this->data->lastInsertId();
            $metadata = ['objectKey'=>$invoice['objectKey'],'manifestSha256'=>$invoice['manifestSha256'],
                         'archiveSha'=>$invoice['archiveSha'],'template'=>$invoice['template'],
                         'compatibilitySha256'=>hash('sha256',Config::encode($invoice['compatibility']))];
            $statement = $this->data->prepare('INSERT INTO ocv_loan_items2(coupon_id,stock_json,decoration) VALUES(?,?,?)');
            $statement->execute([$id,Config::encode($invoice['manifest']),Config::encode($metadata)]);
            $obsolete = $this->data->query('SELECT id FROM ocv_tax_coupons2 ORDER BY id DESC LIMIT 64,4096')->fetchAll(PDO::FETCH_COLUMN);
            if ($obsolete) {
                $ids = array_values(array_filter(array_map('intval',$obsolete),fn(int $old): bool => $old !== $id));
                if ($ids) { $delete = $this->data->prepare('DELETE FROM ocv_tax_coupons2 WHERE id IN('.implode(',',array_fill(0,count($ids),'?')).')'); $delete->execute($ids); }
            }
            $row = $this->select($invoice['job']);
            if ($row === null || !hash_equals($row['invoice_sha'],$fingerprint)) throw new \RuntimeException('The immutable catalog row was not read back');
            $result = $this->format($row,false);
            $this->data->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($this->data->inTransaction()) $this->data->rollBack();
            throw $error;
        } finally { $this->close(); }
    }
}
