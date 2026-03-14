require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KeeperGit'
  s.version = package['version']
  s.summary = package['description']
  s.description = 'Local Expo module that exposes Keeper’s Rust git operations to iOS builds.'
  s.license = 'MIT'
  s.author = 'Keeper'
  s.homepage = 'https://example.invalid/keeper-git'
  s.source = { git: 'https://example.invalid/keeper-git.git', tag: s.version.to_s }
  s.platforms = {
    :ios => '15.1'
  }
  s.swift_version = '5.9'
  s.static_framework = true

  s.source_files = 'ios/**/*.{h,m,swift}'
  s.dependency 'ExpoModulesCore'
  s.preserve_paths = 'scripts/**/*', 'rust/**/*'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'OTHER_LDFLAGS' => '$(inherited) -l"git_core"',
    'LIBRARY_SEARCH_PATHS[sdk=iphoneos*]' => '"$(PODS_TARGET_SRCROOT)/rust/ios/iphoneos-$(CURRENT_ARCH)"',
    'LIBRARY_SEARCH_PATHS[sdk=iphonesimulator*]' => '"$(PODS_TARGET_SRCROOT)/rust/ios/iphonesimulator-$(CURRENT_ARCH)"'
  }

  s.script_phase = {
    :name => 'Build Keeper Git Rust',
    :execution_position => :before_compile,
    :shell_path => '/bin/sh',
    :script => <<-SCRIPT
set -e
"${PODS_TARGET_SRCROOT}/scripts/build-rust.sh" ios "${PODS_TARGET_SRCROOT}/rust/ios"
    SCRIPT
  }
end
