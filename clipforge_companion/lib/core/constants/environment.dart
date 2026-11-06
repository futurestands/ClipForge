/// Environment / endpoint configuration for the ClipForge companion.
///
/// The gateway binds 127.0.0.1:4173 by default (see server/gateway.mjs).
/// A phone or emulator cannot reach the host's loopback address, so start the
/// gateway with HOST=0.0.0.0 and use the machine's LAN IP (or 10.0.2.2 on the
/// Android emulator). Flutter web and desktop can use localhost directly.
class EnvConfig {
  const EnvConfig._();

  static const String defaultBaseUrl = 'http://127.0.0.1:4173';

  static const List<String> presets = <String>[
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'http://10.0.2.2:4173',
  ];

  static const String gatewayHint =
      'Gateway binds 127.0.0.1 by default. For a physical device run '
      'HOST=0.0.0.0 npm run gateway and use your machine LAN IP.';

  /// The React studio is served by the same gateway, at the origin root.
  static String editorUrl(String baseUrl) =>
      baseUrl.replaceAll(RegExp(r'/+$'), '');
}
