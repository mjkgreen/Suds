Pod::Spec.new do |s|
  s.name           = 'SudsPlaceSearch'
  s.version        = '1.0.0'
  s.summary        = "Apple Maps place search (MapKit) for Suds' location picker"
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = ['MapKit', 'CoreLocation']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"
end
