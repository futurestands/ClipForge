import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/validators.dart';
import '../../../shared/models/api_outcome.dart';
import '../../../shared/services/service_providers.dart';
import '../../gateway/data/gateway_repository.dart';
import '../../gateway/providers/gateway_providers.dart';
import '../domain/entities/generation.dart';

class StudioState {
  const StudioState({
    this.prompt = 'A lone astronaut watching a sunrise over an alien ocean',
    this.style = 'cinematic',
    this.count = 5,
    this.duration = 15,
    this.aspect = '16:9',
    this.cap = 2.5,
    this.withImages = false,
    this.withVideo = false,
    this.withVoice = false,
    this.busy = false,
    this.message = '',
    this.script,
    this.images,
    this.video,
    this.voice,
  });

  static const List<String> styles = <String>[
    'auto',
    'cinematic',
    'anime',
    'neon',
    'watercolor',
    'threeD',
    'doc',
  ];

  static const List<String> aspects = <String>['16:9', '9:16', '1:1'];

  final String prompt;
  final String style;
  final int count;
  final int duration;
  final String aspect;
  final double cap;
  final bool withImages;
  final bool withVideo;
  final bool withVoice;
  final bool busy;
  final String message;
  final ApiOutcome<ScriptResult>? script;
  final ApiOutcome<ImageResult>? images;
  final ApiOutcome<VideoResult>? video;
  final ApiOutcome<VoiceResult>? voice;

  bool get hasAnyResult =>
      script != null || images != null || video != null || voice != null;

  StudioState copyWith({
    String? prompt,
    String? style,
    int? count,
    int? duration,
    String? aspect,
    double? cap,
    bool? withImages,
    bool? withVideo,
    bool? withVoice,
    bool? busy,
    String? message,
    ApiOutcome<ScriptResult>? script,
    ApiOutcome<ImageResult>? images,
    ApiOutcome<VideoResult>? video,
    ApiOutcome<VoiceResult>? voice,
    bool clearResults = false,
  }) =>
      StudioState(
        prompt: prompt ?? this.prompt,
        style: style ?? this.style,
        count: count ?? this.count,
        duration: duration ?? this.duration,
        aspect: aspect ?? this.aspect,
        cap: cap ?? this.cap,
        withImages: withImages ?? this.withImages,
        withVideo: withVideo ?? this.withVideo,
        withVoice: withVoice ?? this.withVoice,
        busy: busy ?? this.busy,
        message: message ?? this.message,
        script: clearResults ? null : (script ?? this.script),
        images: clearResults ? null : (images ?? this.images),
        video: clearResults ? null : (video ?? this.video),
        voice: clearResults ? null : (voice ?? this.voice),
      );
}

class StudioController extends Notifier<StudioState> {
  @override
  StudioState build() => const StudioState();

  void patch({
    String? prompt,
    String? style,
    int? count,
    int? duration,
    String? aspect,
    double? cap,
    bool? withImages,
    bool? withVideo,
    bool? withVoice,
  }) {
    state = state.copyWith(
      prompt: prompt,
      style: style,
      count: count,
      duration: duration,
      aspect: aspect,
      cap: cap,
      withImages: withImages,
      withVideo: withVideo,
      withVoice: withVoice,
    );
  }

  /// Drives the same provider chain the React editor uses, via /api.
  /// Any missing key / budget cap / upstream error becomes a fail-soft outcome
  /// that the UI renders as "local fallback", never as a crash.
  Future<void> run() async {
    final StudioState s = state;
    final String? invalid = Validators.prompt(s.prompt);
    if (invalid != null) {
      state = s.copyWith(message: invalid);
      return;
    }

    state = s.copyWith(
      busy: true,
      clearResults: true,
      message: 'Generating shot list…',
    );

    final GatewayRepository repo = ref.read(gatewayRepositoryProvider);
    final ApiOutcome<ScriptResult> script = await repo.generateScript(
      ScriptRequest(
        prompt: s.prompt.trim(),
        style: s.style,
        count: s.count,
        duration: s.duration,
        cap: s.cap,
      ),
    );
    state = state.copyWith(
      script: script,
      message: script.ok
          ? 'Shot list ready · ${script.model}'
          : 'Script: ${script.displayReason}',
    );

    final ScriptResult? data = script.data;
    if (data != null && data.scenes.isNotEmpty) {
      if (s.withImages) {
        state = state.copyWith(message: 'Rendering keyframes…');
        final ApiOutcome<ImageResult> images = await repo.generateImages(
          prompts: data.scenes
              .map((ScriptScene scene) => scene.imagePrompt)
              .toList(),
          aspect: s.aspect,
          cap: s.cap,
        );
        state = state.copyWith(images: images);
      }
      if (s.withVideo) {
        state = state.copyWith(message: 'Submitting hero video job…');
        final ApiOutcome<VideoResult> video = await repo.generateVideo(
          prompt: data.scenes.first.imagePrompt,
          aspect: s.aspect,
          cap: s.cap,
        );
        state = state.copyWith(video: video);
      }
      if (s.withVoice) {
        state = state.copyWith(message: 'Synthesising narration…');
        final ApiOutcome<VoiceResult> voice = await repo.generateVoice(
          text: data.scenes
              .map((ScriptScene scene) => scene.narration)
              .where((String t) => t.isNotEmpty)
              .join(' '),
          cap: s.cap,
        );
        state = state.copyWith(voice: voice);
      }
    }

    state = state.copyWith(
      busy: false,
      message: 'Done · provider spend is logged in Budget',
    );
    ref.invalidate(gatewayStatusProvider);
  }
}

final studioProvider =
    NotifierProvider<StudioController, StudioState>(StudioController.new);
