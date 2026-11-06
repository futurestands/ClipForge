import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/constants/environment.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/services/service_providers.dart';
import '../../../../shared/widgets/editor_link.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../../gateway/providers/gateway_providers.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;
  bool _testing = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: ref.read(baseUrlProvider));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(settingsControllerProvider).setBaseUrl(_controller.text);
    ref.invalidate(gatewayStatusProvider);
    ref.invalidate(fallbackInfoProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gateway origin saved and API client re-pointed')),
      );
    }
  }

  Future<void> _testConnection() async {
    setState(() => _testing = true);
    String message;
    try {
      final status = await ref.read(gatewayRepositoryProvider).fetchStatus();
      message = 'Connected · gateway v${status.version} · '
          '${status.models.length} catalog models';
    } catch (error) {
      message = 'Connection failed: $error';
    }
    if (mounted) {
      setState(() => _testing = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final String current = ref.watch(baseUrlProvider);
    return ListView(
      padding: const EdgeInsets.all(AppSizes.m),
      children: <Widget>[
        SectionCard(
          title: 'Gateway origin',
          subtitle: 'All /api traffic and the React editor are served from here.',
          child: Form(
            key: _formKey,
            child: Column(
              children: <Widget>[
                TextFormField(
                  controller: _controller,
                  decoration: const InputDecoration(
                    labelText: 'Base URL',
                    hintText: EnvConfig.defaultBaseUrl,
                    prefixIcon: Icon(Icons.dns_outlined, size: 18),
                  ),
                  validator: Validators.baseUrl,
                ),
                const SizedBox(height: AppSizes.m),
                Wrap(
                  spacing: AppSizes.s,
                  children: <Widget>[
                    for (final String preset in EnvConfig.presets)
                      ActionChip(
                        label: Text(preset, style: const TextStyle(fontSize: 11)),
                        onPressed: () => setState(() => _controller.text = preset),
                      ),
                  ],
                ),
                const SizedBox(height: AppSizes.m),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _save,
                        icon: const Icon(Icons.save_outlined, size: 16),
                        label: const Text('Save origin'),
                      ),
                    ),
                    const SizedBox(width: AppSizes.s),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _testing ? null : _testConnection,
                        icon: _testing
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.network_check, size: 16),
                        label: const Text('Test'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        SectionCard(
          title: 'Current connection',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(current, style: const TextStyle(fontSize: 13)),
              const SizedBox(height: AppSizes.s),
              const Text(
                EnvConfig.gatewayHint,
                style: TextStyle(color: AppColors.muted, fontSize: 11),
              ),
              const SizedBox(height: AppSizes.m),
              OutlinedButton.icon(
                onPressed: () => unawaited(openEditor(context, current)),
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open the ClipForge editor'),
              ),
            ],
          ),
        ),
        SectionCard(
          title: 'Contract check',
          subtitle: 'The gateway exposes 12 /api endpoints. A zero-dependency '
              'Node probe verifies all of them and refreshes the JSON fixtures '
              'used by the Dart unit tests.',
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('node tool/contract_probe.mjs', style: TextStyle(fontSize: 12)),
              SizedBox(height: AppSizes.s),
              Text(
                'Run it from the clipforge_companion folder while npm run gateway '
                'is running. It checks GET /api/{health,status,models,fallback}, '
                'POST /api/{keys,models,budget,script,image,video,voice} and the '
                '404 behaviour for unknown routes.',
                style: TextStyle(color: AppColors.muted, fontSize: 11),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.l),
      ],
    );
  }
}
