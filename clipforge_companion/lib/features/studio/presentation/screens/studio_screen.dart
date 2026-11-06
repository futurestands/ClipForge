import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/models/api_outcome.dart';
import '../../../../shared/services/service_providers.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/editor_link.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../domain/entities/generation.dart';
import '../../providers/studio_provider.dart';

class StudioScreen extends ConsumerWidget {
  const StudioScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final StudioState state = ref.watch(studioProvider);
    final StudioController controller = ref.read(studioProvider.notifier);
    final String baseUrl = ref.watch(baseUrlProvider);

    return ListView(
      padding: const EdgeInsets.all(AppSizes.m),
      children: <Widget>[
        SectionCard(
          title: 'Prompt lab',
          subtitle: 'POST /api/script → optional /api/image, /api/video, /api/voice. '
              'Every step fails soft when no key is configured.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              TextFormField(
                initialValue: state.prompt,
                maxLines: 3,
                onChanged: (String v) => controller.patch(prompt: v),
                decoration: const InputDecoration(
                  labelText: 'Describe the video',
                  alignLabelWithHint: true,
                  prefixIcon: Icon(Icons.auto_awesome, size: 18),
                ),
              ),
              const SizedBox(height: AppSizes.m),
              Row(
                children: <Widget>[
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: state.style,
                      decoration: const InputDecoration(labelText: 'Visual style'),
                      items: <DropdownMenuItem<String>>[
                        for (final String style in StudioState.styles)
                          DropdownMenuItem<String>(value: style, child: Text(style)),
                      ],
                      onChanged: (String? v) => controller.patch(style: v),
                    ),
                  ),
                  const SizedBox(width: AppSizes.s),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: state.aspect,
                      decoration: const InputDecoration(labelText: 'Aspect'),
                      items: <DropdownMenuItem<String>>[
                        for (final String aspect in StudioState.aspects)
                          DropdownMenuItem<String>(value: aspect, child: Text(aspect)),
                      ],
                      onChanged: (String? v) => controller.patch(aspect: v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSizes.m),
              _SliderRow(
                label: 'Shots',
                value: '${state.count}',
                min: 3,
                max: 8,
                divisions: 5,
                current: state.count.toDouble(),
                onChanged: (double v) => controller.patch(count: v.round()),
              ),
              _SliderRow(
                label: 'Duration',
                value: '${state.duration}s',
                min: 5,
                max: 30,
                divisions: 5,
                current: state.duration.toDouble(),
                onChanged: (double v) => controller.patch(duration: v.round()),
              ),
              _SliderRow(
                label: 'Budget cap',
                value: Formatters.usd(state.cap),
                min: 0,
                max: 10,
                divisions: 40,
                current: state.cap,
                onChanged: (double v) => controller.patch(cap: v),
              ),
              const Divider(height: AppSizes.xl),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: state.withImages,
                title: const Text('Render keyframes', style: TextStyle(fontSize: 13)),
                subtitle: const Text('/api/image · FLUX.2 Pro', style: TextStyle(fontSize: 11)),
                onChanged: (bool v) => controller.patch(withImages: v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: state.withVideo,
                title: const Text('Hero video clip', style: TextStyle(fontSize: 13)),
                subtitle: const Text('/api/video · Veo 3.1 queue (slow)', style: TextStyle(fontSize: 11)),
                onChanged: (bool v) => controller.patch(withVideo: v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: state.withVoice,
                title: const Text('Narration', style: TextStyle(fontSize: 13)),
                subtitle: const Text('/api/voice · ElevenLabs', style: TextStyle(fontSize: 11)),
                onChanged: (bool v) => controller.patch(withVoice: v),
              ),
              const SizedBox(height: AppSizes.m),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: state.busy ? null : () => unawaited(controller.run()),
                  icon: state.busy
                      ? const SizedBox(
                          width: 15,
                          height: 15,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.play_arrow, size: 18),
                  label: Text(state.busy ? 'Generating…' : 'Run generation chain'),
                ),
              ),
            ],
          ),
        ),
        if (state.message.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSizes.m),
            child: Row(
              children: <Widget>[
                const Icon(Icons.info_outline, size: 15, color: AppColors.accent),
                const SizedBox(width: AppSizes.s),
                Expanded(
                  child: Text(
                    state.message,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        if (state.hasAnyResult) ...<Widget>[
          _ScriptCard(outcome: state.script),
          _SimpleOutcome(
            title: 'Keyframes',
            icon: Icons.image_outlined,
            outcome: state.images,
            detail: (ImageResult r) =>
                '${r.renderedCount}/${r.images.length} frames rendered via ${r.model}',
          ),
          _SimpleOutcome(
            title: 'Hero video',
            icon: Icons.movie_outlined,
            outcome: state.video,
            detail: (VideoResult r) => 'Clip ready via ${r.model}',
          ),
          _SimpleOutcome(
            title: 'Narration',
            icon: Icons.record_voice_over_outlined,
            outcome: state.voice,
            detail: (VoiceResult r) => 'Audio ready via ${r.model}',
          ),
          SectionCard(
            title: 'Finish in the editor',
            subtitle: 'The companion drives the model gateway; the React studio '
                'turns the shot list into a timeline and exports a real WebM.',
            child: FilledButton.icon(
              onPressed: () => unawaited(openEditor(context, baseUrl)),
              icon: const Icon(Icons.open_in_new, size: 16),
              label: const Text('Open ClipForge editor'),
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.s, vertical: AppSizes.m),
          child: Text(
            AppStrings.failSoftHint,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
        ),
        const SizedBox(height: AppSizes.l),
      ],
    );
  }
}

class _SliderRow extends StatelessWidget {
  const _SliderRow({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.current,
    required this.onChanged,
  });

  final String label;
  final String value;
  final double min;
  final double max;
  final int divisions;
  final double current;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 86,
          child: Text(label, style: const TextStyle(fontSize: 12)),
        ),
        Expanded(
          child: Slider(
            value: current.clamp(min, max).toDouble(),
            min: min,
            max: max,
            divisions: divisions,
            onChanged: onChanged,
          ),
        ),
        SizedBox(
          width: 52,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(color: AppColors.accent, fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class _ScriptCard extends StatelessWidget {
  const _ScriptCard({required this.outcome});

  final ApiOutcome<ScriptResult>? outcome;

  @override
  Widget build(BuildContext context) {
    if (outcome == null) return const SizedBox.shrink();
    final ApiOutcome<ScriptResult> result = outcome!;
    if (!result.ok) {
      return _FallbackTile(step: 'Shot list', reason: result.displayReason);
    }
    final ScriptResult script = result.data!;
    return SectionCard(
      title: 'Shot list',
      subtitle: '${script.scenes.length} scenes · ${script.model} · '
          '${Formatters.usd(script.cost)}',
      child: Column(
        children: <Widget>[
          for (int i = 0; i < script.scenes.length; i++)
            _SceneTile(index: i + 1, scene: script.scenes[i]),
        ],
      ),
    );
  }
}

class _SceneTile extends StatelessWidget {
  const _SceneTile({required this.index, required this.scene});

  final int index;
  final ScriptScene scene;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.s),
      padding: const EdgeInsets.all(AppSizes.m),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              CircleAvatar(
                radius: 11,
                backgroundColor: AppColors.accent.withOpacity(0.2),
                child: Text(
                  '$index',
                  style: const TextStyle(color: AppColors.accent, fontSize: 11),
                ),
              ),
              const SizedBox(width: AppSizes.s),
              Text(
                scene.beat.isEmpty ? 'Shot $index' : scene.beat,
                style: const TextStyle(color: AppColors.muted, fontSize: 11),
              ),
              const Spacer(),
              if (scene.caption.isNotEmpty)
                Text(
                  scene.caption,
                  style: const TextStyle(
                    color: AppColors.text,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          if (scene.narration.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSizes.s),
            Text(scene.narration, style: const TextStyle(fontSize: 12)),
          ],
          if (scene.camera.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSizes.xs),
            Text('Camera · ${scene.camera}',
                style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          ],
          if (scene.imagePrompt.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSizes.xs),
            Text('Image prompt · ${scene.imagePrompt}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.accent, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}

/// Generic over the payload type so image/video/voice outcomes share one tile.
class _SimpleOutcome<T> extends StatelessWidget {
  const _SimpleOutcome({
    required this.title,
    required this.icon,
    required this.outcome,
    required this.detail,
  });

  final String title;
  final IconData icon;
  final ApiOutcome<T>? outcome;
  final String Function(T data) detail;

  @override
  Widget build(BuildContext context) {
    if (outcome == null) return const SizedBox.shrink();
    final ApiOutcome<T> result = outcome!;
    if (!result.ok) {
      return _FallbackTile(step: title, reason: result.displayReason);
    }
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSizes.m),
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: Icon(icon, color: AppColors.success),
        title: Text(title, style: const TextStyle(fontSize: 13)),
        subtitle: Text(
          result.data == null ? 'Ready' : detail(result.data as T),
          style: const TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ),
    );
  }
}

class _FallbackTile extends StatelessWidget {
  const _FallbackTile({required this.step, required this.reason});

  final String step;
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.m),
      padding: const EdgeInsets.all(AppSizes.m),
      decoration: BoxDecoration(
        color: AppColors.warn.withOpacity(0.08),
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: AppColors.warn.withOpacity(0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.bolt, size: 18, color: AppColors.warn),
          const SizedBox(width: AppSizes.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '$step → local fallback',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                ),
                const SizedBox(height: AppSizes.xs),
                Text(
                  reason,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
                const SizedBox(height: AppSizes.xs),
                const Text(
                  'Director v1 + procedural art still produce the full cut in the React editor.',
                  style: TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
