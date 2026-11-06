import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../../gateway/domain/entities/catalog_model.dart';
import '../../../gateway/domain/entities/gateway_status.dart';
import '../../../gateway/providers/gateway_providers.dart';

class ModelsScreen extends ConsumerWidget {
  const ModelsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<GatewayStatus> async = ref.watch(gatewayStatusProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stack) => ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(gatewayStatusProvider),
      ),
      data: (GatewayStatus status) {
        final ModelDefaults defaults = status.defaults;
        return ListView(
          padding: const EdgeInsets.all(AppSizes.m),
          children: <Widget>[
            _ModelsForm(
              key: ValueKey<String>(
                '${defaults.scriptModel}|${defaults.imageModel}|'
                '${defaults.videoModel}|${defaults.voiceModel}',
              ),
              defaults: defaults,
            ),
            SectionCard(
              title: 'Frontier catalog',
              subtitle: '${status.models.length} routed capabilities · '
                  '${status.configuredCount} with a key configured.',
              child: Column(
                children: <Widget>[
                  for (final CatalogModel model in status.models)
                    _CatalogTile(model: model),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.l),
          ],
        );
      },
    );
  }
}

class _ModelsForm extends ConsumerStatefulWidget {
  const _ModelsForm({super.key, required this.defaults});

  final ModelDefaults defaults;

  @override
  ConsumerState<_ModelsForm> createState() => _ModelsFormState();
}

class _ModelsFormState extends ConsumerState<_ModelsForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _script;
  late final TextEditingController _image;
  late final TextEditingController _video;
  late final TextEditingController _voice;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _script = TextEditingController(text: widget.defaults.scriptModel);
    _image = TextEditingController(text: widget.defaults.imageModel);
    _video = TextEditingController(text: widget.defaults.videoModel);
    _voice = TextEditingController(text: widget.defaults.voiceModel);
  }

  @override
  void dispose() {
    _script.dispose();
    _image.dispose();
    _video.dispose();
    _voice.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(gatewayActionsProvider).saveModels(
            ModelDefaults(
              scriptModel: _script.text.trim(),
              imageModel: _image.text.trim(),
              videoModel: _video.text.trim(),
              voiceModel: _voice.text.trim(),
            ),
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Model routing saved to the gateway')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Model routing',
      subtitle: 'POST /api/models · the gateway uses these ids for every capability.',
      child: Form(
        key: _formKey,
        child: Column(
          children: <Widget>[
            _modelField('Script model', _script, 'gpt-5.1'),
            _modelField('Image model', _image, 'fal-ai/flux-2-pro'),
            _modelField('Video model', _video, 'fal-ai/veo3.1'),
            _modelField('Voice model', _voice, 'eleven_multilingual_v2'),
            const SizedBox(height: AppSizes.m),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined, size: 16),
                label: Text(_saving ? 'Saving…' : 'Save routing'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _modelField(String label, TextEditingController controller, String hint) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.m),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label, hintText: hint),
        validator: Validators.modelId,
        textInputAction: TextInputAction.next,
      ),
    );
  }
}

class _CatalogTile extends StatelessWidget {
  const _CatalogTile({required this.model});

  final CatalogModel model;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      key: ValueKey<String>(model.id),
      tilePadding: EdgeInsets.zero,
      leading: Chip(
        label: Text(model.capabilityLabel),
        visualDensity: VisualDensity.compact,
        backgroundColor: AppColors.surfaceAlt,
      ),
      title: Text(model.label, style: const TextStyle(fontSize: 13)),
      subtitle: Text(
        '${model.provider} · ${Formatters.usd(model.cost)} / call',
        style: const TextStyle(color: AppColors.muted, fontSize: 11),
      ),
      children: <Widget>[
        Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.only(bottom: AppSizes.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(model.detail, style: const TextStyle(fontSize: 12)),
                const SizedBox(height: AppSizes.s),
                Text(
                  'Contract: ${model.contract}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
                Text(
                  'Env: ${model.env} · tier: ${model.tier} · id: ${model.id}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
                const SizedBox(height: AppSizes.s),
                Text(
                  'Alternatives: ${model.alternatives.join(', ')}',
                  style: const TextStyle(color: AppColors.accent, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
