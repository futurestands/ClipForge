import '../../../../core/utils/json_cast.dart';

/// Mirrors POST /api/script request body (server/gateway.mjs · callScript).
class ScriptRequest {
  const ScriptRequest({
    required this.prompt,
    required this.style,
    required this.count,
    required this.duration,
    required this.cap,
  });

  final String prompt;
  final String style;
  final int count;
  final int duration;
  final double cap;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'prompt': prompt,
        'style': style,
        'count': count,
        'duration': duration,
        'cap': cap,
      };
}

class ScriptScene {
  const ScriptScene({
    required this.beat,
    required this.caption,
    required this.narration,
    required this.camera,
    required this.imagePrompt,
  });

  factory ScriptScene.fromJson(Map<String, dynamic> json) => ScriptScene(
        beat: asString(json['beat']),
        caption: asString(json['caption']),
        narration: asString(json['narration']),
        camera: asString(json['camera']),
        imagePrompt: asString(json['imagePrompt']),
      );

  final String beat;
  final String caption;
  final String narration;
  final String camera;
  final String imagePrompt;
}

class ScriptResult {
  const ScriptResult({required this.scenes, required this.model, required this.cost});

  factory ScriptResult.fromJson(Map<String, dynamic> json) => ScriptResult(
        scenes: asMapList(json['scenes']).map(ScriptScene.fromJson).toList(),
        model: asString(json['model']),
        cost: asDouble(json['cost']),
      );

  final List<ScriptScene> scenes;
  final String model;
  final double cost;
}

class ImageResult {
  const ImageResult({required this.images, required this.model, required this.cost});

  factory ImageResult.fromJson(Map<String, dynamic> json) => ImageResult(
        images: json['images'] is List
            ? (json['images'] as List).map((dynamic e) => e?.toString()).toList()
            : <String?>[],
        model: asString(json['model']),
        cost: asDouble(json['cost']),
      );

  /// Data URLs; null means that shot keeps its procedural fallback frame.
  final List<String?> images;
  final String model;
  final double cost;

  int get renderedCount => images.where((String? e) => e != null && e.isNotEmpty).length;
}

class VideoResult {
  const VideoResult({required this.videoUrl, required this.model, required this.cost});

  factory VideoResult.fromJson(Map<String, dynamic> json) => VideoResult(
        videoUrl: asString(json['videoUrl']),
        model: asString(json['model']),
        cost: asDouble(json['cost']),
      );

  final String videoUrl;
  final String model;
  final double cost;
}

class VoiceResult {
  const VoiceResult({required this.audio, required this.model, required this.cost});

  factory VoiceResult.fromJson(Map<String, dynamic> json) => VoiceResult(
        audio: asString(json['audio']),
        model: asString(json['model']),
        cost: asDouble(json['cost']),
      );

  /// data:audio/mpeg;base64,... returned by the ElevenLabs adapter.
  final String audio;
  final String model;
  final double cost;
}

class FallbackInfo {
  const FallbackInfo({required this.message, required this.providers});

  factory FallbackInfo.fromJson(Map<String, dynamic> json) => FallbackInfo(
        message: asString(json['message']),
        providers: asMap(json['providers'])
            .map((String k, dynamic v) => MapEntry<String, bool>(k, asBool(v))),
      );

  final String message;
  final Map<String, bool> providers;
}
