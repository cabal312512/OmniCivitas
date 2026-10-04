<?php
use PHPUnit\Framework\TestCase;
final class ServiceTest extends TestCase {
    public function testSearchUsesActualMysql(): void {
        $body=file_get_contents('http://laravel:8001/api/search.php?q=phase9',false,stream_context_create(['http'=>['timeout'=>6,'header'=>'Accept: application/json']]));
        $value=json_decode($body,true,512,JSON_THROW_ON_ERROR);
        self::assertTrue($value['canContinue']);
        self::assertSame('MySQL LIKE',$value['protocol']);
        self::assertIsArray($value['rows']);
    }
    public function testMalformedReceiptIsRejectedBeforeStorage(): void {
        $body=file_get_contents('http://laravel:8001/api/nodeService',false,stream_context_create(['http'=>['method'=>'POST','timeout'=>6,'ignore_errors'=>true,'header'=>"Content-Type: application/json\r\nAccept: application/json",'content'=>'{}']]));
        self::assertStringContainsString('422',$http_response_header[0]);
        self::assertArrayHasKey('errors',json_decode($body,true,512,JSON_THROW_ON_ERROR));
    }
}
