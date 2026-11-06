import '../../../core/errors/failures.dart';
import '../../../core/utils/json_cast.dart';
import '../../../shared/models/api_outcome.dart';
import '../../studio/domain/entities/generation.dart';
import '../domain/entities/gateway_status.dart';
import 'gateway_remote_datasource.dart';

/// Parses raw gateway JSON into immutable entities and turns every provider
/// failure into a fail-soft [ApiOutcome] instead of an exception.
class GatewayRepository {
  const GatewayRepository(this._source);

  final GatewayRemoteDataSource _source;

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<ApiOutcome<T>> _providerCall<T>(
    Future<Map<String, dynamic>> Function() call,
    T Function(Map<String, dynamic> json) parse,
  ) async {
    try {
      final Map<String, dynamic> json = await call();
      if (json['ok'] != true) {
        return ApiOutcome<T>.failure(asString(json['reason'], 'Provider unavailable'));
      }
      return ApiOutcome<T>.success(
        parse(json),
        model: json['model']?.toString(),
        cost: json['cost'] == null ? null : asDouble(json['cost']),
      );
    } catch (error) {
      return ApiOutcome<T>.failure(mapDioError(error).message);
    }
  }

  Future<GatewayStatus> fetchStatus() => _guard(() async {
        return GatewayStatus.fromJson(await _source.status());
      });

  Future<FallbackInfo> fetchFallback() => _guard(() async {
        return FallbackInfo.fromJson(await _source.fallback());
      });

  /// /api/keys echoes the whole status object, so saving keys refreshes state.
  Future<GatewayStatus> saveKeys(Map<String, String> keys) => _guard(() async {
        return GatewayStatus.fromJson(await _source.saveKeys(keys));
      });

  Future<ModelDefaults> saveModels(ModelDefaults defaults) => _guard(() async {
        final Map<String, dynamic> json = await _source.saveModels(defaults.toJson());
        return ModelDefaults.fromJson(asMap(json['defaults']));
      });

  Future<GatewayBudget> setBudget({required double cap, bool reset = false}) =>
      _guard(() async {
        final Map<String, dynamic> json =
            await _source.setBudget(cap: cap, reset: reset);
        return GatewayBudget.fromJson(asMap(json['budget']));
      });

  Future<ApiOutcome<ScriptResult>> generateScript(ScriptRequest request) =>
      _providerCall(
        () => _source.script(request.toJson()),
        ScriptResult.fromJson,
      );

  Future<ApiOutcome<ImageResult>> generateImages({
    required List<String> prompts,
    required String aspect,
    required double cap,
  }) =>
      _providerCall(
        () => _source.image(<String, dynamic>{
          'prompts': prompts,
          'aspect': aspect,
          'cap': cap,
        }),
        ImageResult.fromJson,
      );

  Future<ApiOutcome<VideoResult>> generateVideo({
    required String prompt,
    required String aspect,
    required double cap,
  }) =>
      _providerCall(
        () => _source.video(<String, dynamic>{
          'prompt': prompt,
          'aspect': aspect,
          'cap': cap,
        }),
        VideoResult.fromJson,
      );

  Future<ApiOutcome<VoiceResult>> generateVoice({
    required String text,
    required double cap,
  }) =>
      _providerCall(
        () => _source.voice(<String, dynamic>{'text': text, 'cap': cap}),
        VoiceResult.fromJson,
      );
}
