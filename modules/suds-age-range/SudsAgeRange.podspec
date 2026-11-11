# The DeclaredAgeRange framework exists from the iOS 26 SDK on. Link it weakly
# (the app still runs on older iOS) and only when the build machine's SDK has
# it; on an older SDK the Swift code compiles without it and reports
# "unavailable".
sdk_path = `xcrun --sdk iphoneos --show-sdk-path 2>/dev/null`.strip
has_declared_age_range = !sdk_path.empty? &&
  File.exist?(File.join(sdk_path, 'System/Library/Frameworks/DeclaredAgeRange.framework'))

Pod::Spec.new do |s|
  s.name           = 'SudsAgeRange'
  s.version        = '1.0.0'
  s.summary        = "Apple's Declared Age Range API and the device region for Suds age checks"
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = ['DeclaredAgeRange'] if has_declared_age_range

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "ios/**/*.{h,m,mm,swift,hpp,cpp}"
end
