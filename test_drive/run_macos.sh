#!/bin/bash
# Use Xcode's clang instead of Homebrew's LLVM
export PATH="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin:$PATH"
export CC="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang"
export CXX="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++"

echo "Using clang: $(which clang)"
echo "Version: $(clang --version | head -1)"

flutter run -d macos "$@"

