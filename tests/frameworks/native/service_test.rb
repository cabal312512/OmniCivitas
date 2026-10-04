require 'minitest/autorun'
require 'net/http'
require 'json'
class ServiceTest < Minitest::Test
  def get(path)
    Net::HTTP.start('sinatra',8004,open_timeout:3,read_timeout:6){|http|
      response=http.get(path)
      assert_equal '200',response.code
      JSON.parse(response.body)
    }
  end
  def test_real_nested_json
    receipt=get('/api/old.cgi')
    nested=JSON.parse(receipt.fetch('jsonInsideJson'))
    assert_equal 'Ruby Sinatra',nested.fetch('service')
    assert_match(/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/,nested.fetch('displayRequestId'))
  end
  def test_real_health
    assert_equal true,get('/health').fetch('canContinue')
  end
end
