import 'package:dio/dio.dart';

/// Typed failures. Everything is converted into a short user-facing message so
/// the UI never has to know about Dio internals.
abstract class Failure implements Exception {
  const Failure(this.message);

  final String message;

  @override
  String toString() => message;
}

class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, this.statusCode);

  final int statusCode;
}

class ParseFailure extends Failure {
  const ParseFailure(super.message);
}

/// Maps a thrown object to a [Failure].
///
/// The gateway returns `{ok:false, reason}` with HTTP 200 for provider errors;
/// those never reach here (the repository handles them as fail-soft outcomes).
Failure mapDioError(Object error) {
  if (error is Failure) return error;
  if (error is DioException) {
    final Response<dynamic>? response = error.response;
    final dynamic body = response?.data;
    final String? reason = body is Map && body['reason'] != null
        ? body['reason'].toString()
        : body is Map && body['error'] != null
            ? body['error'].toString()
            : null;
    if (response != null) {
      return ServerFailure(
        reason ?? 'Gateway returned HTTP ${response.statusCode}',
        response.statusCode ?? 0,
      );
    }
    return NetworkFailure(error.message ?? 'Cannot reach the ClipForge gateway');
  }
  return ParseFailure(error.toString());
}
