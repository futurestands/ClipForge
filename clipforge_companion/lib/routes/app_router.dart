import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/budget/presentation/screens/budget_screen.dart';
import '../features/gateway/presentation/screens/status_screen.dart';
import '../features/keys/presentation/screens/keys_screen.dart';
import '../features/models/presentation/screens/models_screen.dart';
import '../features/settings/presentation/screens/settings_screen.dart';
import '../features/studio/presentation/screens/studio_screen.dart';
import '../shared/widgets/app_shell.dart';

/// Named routes give us free deep links: /studio, /budget, /keys, ...
enum AppRoute {
  status('/', 'status'),
  studio('/studio', 'studio'),
  models('/models', 'models'),
  keys('/keys', 'keys'),
  budget('/budget', 'budget'),
  settings('/settings', 'settings');

  const AppRoute(this.path, this.name);

  final String path;
  final String name;
}

final routerProvider = Provider<GoRouter>((Ref ref) {
  return GoRouter(
    initialLocation: AppRoute.status.path,
    routes: <RouteBase>[
      ShellRoute(
        builder: (BuildContext context, GoRouterState state, Widget child) =>
            AppShell(child: child),
        routes: <RouteBase>[
          GoRoute(
            path: AppRoute.status.path,
            name: AppRoute.status.name,
            builder: (_, __) => const StatusScreen(),
          ),
          GoRoute(
            path: AppRoute.studio.path,
            name: AppRoute.studio.name,
            builder: (_, __) => const StudioScreen(),
          ),
          GoRoute(
            path: AppRoute.models.path,
            name: AppRoute.models.name,
            builder: (_, __) => const ModelsScreen(),
          ),
          GoRoute(
            path: AppRoute.keys.path,
            name: AppRoute.keys.name,
            builder: (_, __) => const KeysScreen(),
          ),
          GoRoute(
            path: AppRoute.budget.path,
            name: AppRoute.budget.name,
            builder: (_, __) => const BudgetScreen(),
          ),
          GoRoute(
            path: AppRoute.settings.path,
            name: AppRoute.settings.name,
            builder: (_, __) => const SettingsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (BuildContext context, GoRouterState state) => Scaffold(
      appBar: AppBar(title: const Text('Route not found')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text('No companion screen for ${state.uri}'),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.go(AppRoute.status.path),
              child: const Text('Back to status'),
            ),
          ],
        ),
      ),
    ),
  );
});
