Pod::Spec.new do |s|
  s.name           = 'SudsLiveActivityBridge'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit bridge for Suds Live Activities'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"
end
