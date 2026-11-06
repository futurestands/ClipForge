import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants/environment.dart';

/// Opens the React studio (served at the gateway origin). If no platform
/// launcher is available (tests, desktop without a browser handler) we show the
/// URL instead of throwing — fail soft, like the gateway itself.
Future<void> openEditor(BuildContext context, String baseUrl) async {
  final Uri uri = Uri.parse(EnvConfig.editorUrl(baseUrl));
  bool launched = false;
  try {
    if (await canLaunchUrl(uri)) {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  } catch (_) {
    launched = false;
  }
  if (!launched && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Open the editor at $uri')),
    );
  }
}
