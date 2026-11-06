class Validators {
  const Validators._();

  /// Gateway origins are http/https with an optional port; no path, no trailing slash.
  static String? baseUrl(String? value) {
    final String raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Enter a gateway URL';
    final Uri? uri = Uri.tryParse(raw);
    if (uri == null || !uri.hasScheme) return 'Include http:// or https://';
    if (uri.scheme != 'http' && uri.scheme != 'https') return 'Only http/https are supported';
    if (uri.host.isEmpty) return 'Missing host';
    if (uri.path.isNotEmpty && uri.path != '/') return 'Remove the path — the app adds /api';
    return null;
  }

  static String? prompt(String? value) {
    final String raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Describe the video you want';
    if (raw.length < 8) return 'Add a little more detail';
    return null;
  }

  static String? modelId(String? value) {
    final String raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Model id cannot be empty';
    if (raw.length > 120) return 'Max 120 characters';
    return null;
  }
}
