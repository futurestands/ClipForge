/// Fail-soft result wrapper.
///
/// The gateway answers provider calls with HTTP 200 + `{ok:false, reason}`
/// whenever a key is missing, a budget cap is hit, or an upstream model fails.
/// That is NOT an app error: the React editor falls back to Director v1 and
/// procedural art. [ApiOutcome.failure] keeps that distinction explicit so the
/// UI can show a friendly "local fallback" state instead of a red error.
class ApiOutcome<T> {
  const ApiOutcome._({
    required this.ok,
    this.data,
    this.reason,
    this.model,
    this.cost,
  });

  factory ApiOutcome.success(T data, {String? model, double? cost}) =>
      ApiOutcome<T>._(ok: true, data: data, model: model, cost: cost);

  factory ApiOutcome.failure(String reason) =>
      ApiOutcome<T>._(ok: false, reason: reason);

  final bool ok;
  final T? data;
  final String? reason;
  final String? model;
  final double? cost;

  bool get usedFallback => !ok;

  /// Convenience for screens that only need to display a message.
  String get displayReason => reason ?? 'Unknown provider response';

  ApiOutcome<S> map<S>(S Function(T data) transform) => ok && data != null
      ? ApiOutcome<S>.success(transform(data as T), model: model, cost: cost)
      : ApiOutcome<S>.failure(displayReason);

  @override
  String toString() => ok
      ? 'ApiOutcome.ok(${data == null ? 'no payload' : 'payload'}'
          '${model == null ? '' : ' via $model'})'
      : 'ApiOutcome.fallback($reason)';
}
