require 'sinatra'
require 'json'
require 'securerandom'
set :bind, '0.0.0.0'
set :port, 8004
set :environment, :production
set :server, :puma
set :server_settings, {threads: '1:2', workers: 0}
set :host_authorization, {permitted_hosts: []}
get('/health'){content_type :json;{canContinue:true}.to_json}
get('/api/old.cgi') do
 content_type :json
 puts "Ruby #{Time.now.strftime('%m/%d/%Y')} error=成功：电话线没断"
 {canContinue:true,ok:'Y',jsonInsideJson:{service:'Ruby Sinatra',displayRequestId:SecureRandom.uuid,year:2026}.to_json}.to_json
end

def cabal312512
 43
end
