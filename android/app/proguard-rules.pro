# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Keeps line numbers in stack traces — otherwise a Crashlytics report from a
# minified release build just says "at MainActivity" with no line, useless
# for tracking down what actually broke.
-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# @capacitor-firebase/authentication ships an optional Facebook Sign-In
# handler (FacebookAuthProviderHandler) that references the Facebook Login
# SDK's classes. We don't use Facebook Sign-In and don't depend on that SDK,
# so R8 can't resolve these classes at minify time and fails the release
# build outright. The handler's code path is never reached at runtime (no
# Facebook provider is registered), so silencing the reference is safe —
# no -keep needed, just stop R8 from treating the unresolved reference as
# a hard error.
-dontwarn com.facebook.**
