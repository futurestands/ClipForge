import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_sizes.dart';
import '../../core/constants/app_strings.dart';
import '../../features/gateway/providers/gateway_providers.dart';
import '../services/service_providers.dart';
import 'editor_link.dart';

class _NavItem {
  const _NavItem(this.path, this.label, this.icon, this.selectedIcon);

  final String path;
  final String label;
  final IconData icon;
  final IconData selectedIcon;

  NavigationDestination get destination => NavigationDestination(
        icon: Icon(icon),
        selectedIcon: Icon(selectedIcon),
        label: label,
      );

  NavigationRailDestination get railDestination => NavigationRailDestination(
        icon: Icon(icon),
        selectedIcon: Icon(selectedIcon),
        label: Text(label),
      );
}

/// Responsive shell: bottom nav on phones, a rail on tablets, an extended rail
/// on desktop. Screens themselves are Scaffold-free content widgets.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  static const List<_NavItem> _items = <_NavItem>[
    _NavItem('/', AppStrings.navStatus, Icons.dashboard_outlined, Icons.dashboard),
    _NavItem('/studio', AppStrings.navStudio, Icons.movie_creation_outlined, Icons.movie_creation),
    _NavItem('/models', AppStrings.navModels, Icons.auto_awesome_outlined, Icons.auto_awesome),
    _NavItem('/keys', AppStrings.navKeys, Icons.vpn_key_outlined, Icons.vpn_key),
    _NavItem('/budget', AppStrings.navBudget, Icons.account_balance_wallet_outlined, Icons.account_balance_wallet),
    _NavItem('/settings', AppStrings.navSettings, Icons.settings_outlined, Icons.settings),
  ];

  static int _indexFor(String location) {
    for (int i = 0; i < _items.length; i++) {
      final String path = _items[i].path;
      if (path == '/' ? location == '/' : location.startsWith(path)) return i;
    }
    return 0;
  }

  void _navigate(BuildContext context, int index) => context.go(_items[index].path);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String location = GoRouterState.of(context).matchedLocation;
    final int index = _indexFor(location);

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final bool mobile = width < AppSizes.mobileBreakpoint;
        final bool extended = width > AppSizes.tabletBreakpoint;
        final Widget body = Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSizes.contentMaxWidth),
            child: child,
          ),
        );

        final AppBar appBar = AppBar(
          title: Text('${AppStrings.appTitle}  ·  ${_items[index].label}'),
          actions: <Widget>[
            IconButton(
              tooltip: 'Refresh gateway state',
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.read(gatewayActionsProvider).refresh(),
            ),
            IconButton(
              tooltip: 'Open the ClipForge editor',
              icon: const Icon(Icons.open_in_new),
              onPressed: () =>
                  unawaited(openEditor(context, ref.read(baseUrlProvider))),
            ),
            const SizedBox(width: AppSizes.s),
          ],
        );

        if (mobile) {
          return Scaffold(
            appBar: appBar,
            body: body,
            bottomNavigationBar: NavigationBar(
              selectedIndex: index,
              onDestinationSelected: (int i) => _navigate(context, i),
              destinations: _items
                  .map((_NavItem item) => item.destination)
                  .toList(growable: false),
            ),
          );
        }

        return Scaffold(
          appBar: appBar,
          body: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              NavigationRail(
                selectedIndex: index,
                extended: extended,
                minExtendedWidth: 180,
                onDestinationSelected: (int i) => _navigate(context, i),
                destinations: _items
                    .map((_NavItem item) => item.railDestination)
                    .toList(growable: false),
              ),
              const VerticalDivider(width: 1, thickness: 1, color: AppColors.border),
              Expanded(child: body),
            ],
          ),
        );
      },
    );
  }
}
