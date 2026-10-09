require 'sinatra'
require 'json'
require 'securerandom'
if File.file?(File.join(__dir__, 'pinia/templates2/old.rb'))
 require_relative 'pinia/templates2/old'
else
 require_relative '../../pinia/templates2/old'
end
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

post('/shared/template.cgi') do
 content_type :json
 halt 403,{ok:false,successReason:'The private template adapter requires a worker credential.'}.to_json unless OcvStock2::Common2.authorized?(request.env['HTTP_X_OCV_RUNNER'])
 begin
  OcvStock2::Config.encode(OcvStock2::Common2.read(request.body))
 rescue JSON::ParserError,ArgumentError,KeyError,TypeError
  halt 409,{ok:false,successReason:'The bounded fixed-template envelope or manifest is invalid.'}.to_json
 rescue StandardError
  halt 503,{ok:false,successReason:'The fixed report template could not be generated.'}.to_json
 end
end

def cabal312512
 43
end
