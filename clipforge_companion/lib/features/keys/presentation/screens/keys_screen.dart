import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../../../shared/widgets/status_dot.dart';
import '../../../gateway/domain/entities/gateway_status.dart';
import '../../../gateway/providers/gateway_providers.dart';

class KeysScreen extends ConsumerStatefulWidget {
  const KeysScreen({super.key});

  @override
  ConsumerState<KeysScreen> createState() => _KeysScreenState();
}

class _KeysScreenState extends ConsumerState<KeysScreen> {
  final TextEditingController _openai = TextEditingController();
  final TextEditingController _fal = TextEditingController();
  final TextEditingController _eleven = TextEditingController();
  final TextEditingController _openaiBase = TextEditingController();
  final TextEditingController _llmBase = TextEditingController();
  final TextEditingController _falBase = TextEditingController();
  bool _busy = false;

  static const List<String> _keyNames = <String>[
    'OPENAI_API_KEY',
    'FAL_KEY',
    'ELEVENLABS_API_KEY',
  ];

  static const List<String> _baseNames = <String>[
    'OPENAI_BASE_URL',
    'LLM_BASE_URL',
    'FAL_BASE_URL',
  ];

  @override
  void dispose() {
    _openai.dispose();
    _fal.dispose();
    _eleven.dispose();
    _openaiBase.dispose();
    _llmBase.dispose();
    _falBase.dispose();
    super.dispose();
  }

  Map<String, String> _payload({bool clear = false}) => <String, String>{
        _keyNames[0]: clear ? '' : _openai.text.trim(),
        _keyNames[1]: clear ? '' : _fal.text.trim(),
        _keyNames[2]: clear ? '' : _eleven.text.trim(),
        _baseNames[0]: clear ? '' : _openaiBase.text.trim(),
        _baseNames[1]: clear ? '' : _llmBase.text.trim(),
        _baseNames[2]: clear ? '' : _falBase.text.trim(),
      };

  Future<void> _submit({bool clear = false}) async {
    setState(() => _busy = true);
    try {
      final GatewayStatus status =
          await ref.read(gatewayActionsProvider).saveKeys(_payload(clear: clear));
      if (clear) {
        _openai.clear();
        _fal.clear();
        _eleven.clear();
        _openaiBase.clear();
        _llmBase.clear();
        _falBase.clear();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(clear
                ? 'Runtime keys cleared · back to 100% local generation'
                : 'Keys applied · ${status.configuredCount}/4 capabilities routed'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not reach gateway: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<GatewayStatus> status = ref.watch(gatewayStatusProvider);
    final GatewayStatus? snapshot = status.asData?.value;

    return ListView(
      padding: const EdgeInsets.all(AppSizes.m),
      children: <Widget>[
        SectionCard(
          title: 'Runtime provider keys',
          subtitle: 'POST /api/keys · applied to the running gateway immediately.',
          child: Column(
            children: <Widget>[
              _secretField('OPENAI_API_KEY', 'Script · GPT-5.1 / OpenRouter', _openai),
              _secretField('FAL_KEY', 'Image + video · fal.ai', _fal),
              _secretField('ELEVENLABS_API_KEY', 'Voice · ElevenLabs TTS', _eleven),
              const SizedBox(height: AppSizes.m),
              Row(
                children: <Widget>[
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy ? null : () => _submit(),
                      icon: const Icon(Icons.key, size: 16),
                      label: const Text('Apply keys'),
                    ),
                  ),
                  const SizedBox(width: AppSizes.s),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _submit(clear: true),
                      icon: const Icon(Icons.delete_outline, size: 16),
                      label: const Text('Clear all'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SectionCard(
          title: 'Custom provider bases',
          subtitle: 'Optional OpenAI-compatible / fal.ai endpoint overrides.',
          child: Column(
            children: <Widget>[
              _textField('OPENAI_BASE_URL', 'https://api.openai.com/v1', _openaiBase),
              _textField('LLM_BASE_URL', 'OpenRouter or another LLM gateway', _llmBase),
              _textField('FAL_BASE_URL', 'fal.ai compatible base', _falBase),
            ],
          ),
        ),
        SectionCard(
          title: 'Active capabilities',
          child: Column(
            children: <Widget>[
              for (final String capability in GatewayStatus.capabilities)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSizes.xs),
                  child: Row(
                    children: <Widget>[
                      StatusDot(
                        active: snapshot?.isConfigured(capability) ?? false,
                      ),
                      const SizedBox(width: AppSizes.m),
                      Expanded(
                        child: Text(
                          snapshot?.labelFor(capability) ?? 'Gateway status loading…',
                          style: const TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.s),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Icon(Icons.privacy_tip_outlined, size: 16, color: AppColors.warn),
              const SizedBox(width: AppSizes.s),
              Expanded(
                child: Text(
                  AppStrings.keyWarning,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSizes.l),
      ],
    );
  }

  Widget _secretField(String label, String hint, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.m),
      child: TextField(
        controller: controller,
        obscureText: true,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: const Icon(Icons.lock_outline, size: 18),
        ),
      ),
    );
  }

  Widget _textField(String label, String hint, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.m),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: const Icon(Icons.link, size: 18),
        ),
      ),
    );
  }
}
