import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Builds the single Dio instance used for every /api call.
///
/// Rebuilt automatically when the user changes the gateway origin in Settings
/// (see dioProvider). Video queue polling can take ~90s upstream, so the
/// receive timeout is generous while connect stays short.
class ApiClient {
  const ApiClient._();

  static Dio create(String baseUrl) {
    final Dio dio = Dio(
      BaseOptions(
        baseUrl: baseUrl.replaceAll(RegExp(r'/+$'), ''),
        connectTimeout: const Duration(seconds: 8),
        sendTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 120),
        responseType: ResponseType.json,
        headers: const <String, String>{
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );
    dio.interceptors.add(_GatewayLogInterceptor());
    return dio;
  }
}

class _GatewayLogInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    debugPrint('→ ${options.method} ${options.uri}');
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    debugPrint('← ${response.statusCode} ${response.requestOptions.uri}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    debugPrint('✗ ${err.type.name} ${err.requestOptions.uri}');
    handler.next(err);
  }
}
