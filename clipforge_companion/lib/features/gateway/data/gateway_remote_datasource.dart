import 'package:dio/dio.dart';

import '../../../core/errors/failures.dart';

/// Raw JSON boundary. Keeping it abstract makes the repository fully testable
/// with captured gateway fixtures — no Dio mocking required.
abstract class GatewayRemoteDataSource {
  Future<Map<String, dynamic>> health();

  Future<Map<String, dynamic>> status();

  Future<Map<String, dynamic>> models();

  Future<Map<String, dynamic>> fallback();

  Future<Map<String, dynamic>> saveKeys(Map<String, String> keys);

  Future<Map<String, dynamic>> saveModels(Map<String, String> models);

  Future<Map<String, dynamic>> setBudget({required double cap, bool reset});

  Future<Map<String, dynamic>> script(Map<String, dynamic> body);

  Future<Map<String, dynamic>> image(Map<String, dynamic> body);

  Future<Map<String, dynamic>> video(Map<String, dynamic> body);

  Future<Map<String, dynamic>> voice(Map<String, dynamic> body);
}

class DioGatewayDataSource implements GatewayRemoteDataSource {
  const DioGatewayDataSource(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final Response<dynamic> response = await _dio.get(path);
      return _asBody(response.data);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    try {
      final Response<dynamic> response = await _dio.post(path, data: body);
      return _asBody(response.data);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Map<String, dynamic> _asBody(dynamic data) {
    if (data is Map) return Map<String, dynamic>.from(data);
    throw const ParseFailure('Gateway returned a non-object response');
  }

  @override
  Future<Map<String, dynamic>> health() => _get('/api/health');

  @override
  Future<Map<String, dynamic>> status() => _get('/api/status');

  @override
  Future<Map<String, dynamic>> models() => _get('/api/models');

  @override
  Future<Map<String, dynamic>> fallback() => _get('/api/fallback');

  @override
  Future<Map<String, dynamic>> saveKeys(Map<String, String> keys) =>
      _post('/api/keys', Map<String, dynamic>.from(keys));

  @override
  Future<Map<String, dynamic>> saveModels(Map<String, String> models) =>
      _post('/api/models', Map<String, dynamic>.from(models));

  @override
  Future<Map<String, dynamic>> setBudget({required double cap, bool reset = false}) =>
      _post('/api/budget', <String, dynamic>{'cap': cap, 'reset': reset});

  @override
  Future<Map<String, dynamic>> script(Map<String, dynamic> body) =>
      _post('/api/script', body);

  @override
  Future<Map<String, dynamic>> image(Map<String, dynamic> body) =>
      _post('/api/image', body);

  @override
  Future<Map<String, dynamic>> video(Map<String, dynamic> body) =>
      _post('/api/video', body);

  @override
  Future<Map<String, dynamic>> voice(Map<String, dynamic> body) =>
      _post('/api/voice', body);
}
