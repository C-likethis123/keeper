#import <React/RCTBridgeModule.h>

// iOS template for Expo prebuild projects.
// Requires linking libgit_core.a from the Rust git_core crate output.
@interface RCT_EXTERN_MODULE(KeeperGitBridge, NSObject)

RCT_EXTERN_METHOD(clone:(NSString *)url
                  path:(NSString *)path
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetch:(NSString *)repoPath
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkout:(NSString *)repoPath
                  reference:(NSString *)reference
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(currentBranch:(NSString *)repoPath
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(listBranches:(NSString *)repoPath
                  remote:(NSString * _Nullable)remote
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(merge:(NSString *)repoPath
                 options:(NSDictionary *)options
                resolver:(RCTPromiseResolveBlock)resolve
                rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(commit:(NSString *)repoPath
                 message:(NSString *)message
                resolver:(RCTPromiseResolveBlock)resolve
                rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(push:(NSString *)repoPath
              resolver:(RCTPromiseResolveBlock)resolve
              rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(status:(NSString *)repoPath
                resolver:(RCTPromiseResolveBlock)resolve
                rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resolveHeadOid:(NSString *)repoPath
                resolver:(RCTPromiseResolveBlock)resolve
                rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(changedMarkdownPaths:(NSString *)repoPath
                  fromOid:(NSString *)fromOid
                  toOid:(NSString *)toOid
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
