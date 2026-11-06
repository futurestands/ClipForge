class AppStrings {
  const AppStrings._();

  static const String appTitle = 'ClipForge Companion';
  static const String navStatus = 'Status';
  static const String navStudio = 'Studio';
  static const String navModels = 'Models';
  static const String navKeys = 'Keys';
  static const String navBudget = 'Budget';
  static const String navSettings = 'Settings';

  static const String offlineHint =
      'Cannot reach the gateway. Start it with npm run serve, then pull to refresh.';
  static const String fallbackTitle = 'Always-on local fallback';
  static const String keyWarning =
      'Keys are sent straight to the running gateway and kept in process memory only. '
      'They are never written to disk by this app or by the gateway, and disappear when it restarts.';
  static const String failSoftHint =
      'The gateway always fails soft. Without a provider key the React editor '
      'generates everything locally with Director v1, procedural art and the critic.';
}
