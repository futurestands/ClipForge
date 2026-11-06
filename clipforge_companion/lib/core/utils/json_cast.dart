/// Defensive JSON readers. The gateway is local and versioned, but a companion
/// app should never crash because one optional field was missing.
Map<String, dynamic> asMap(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> asMapList(dynamic value) => value is List
    ? value.whereType<Map>().map((dynamic m) => Map<String, dynamic>.from(m)).toList()
    : <Map<String, dynamic>>[];

List<String> asStringList(dynamic value) =>
    value is List ? value.map((dynamic e) => e.toString()).toList() : <String>[];

String asString(dynamic value, [String fallback = '']) =>
    value == null ? fallback : value.toString();

double asDouble(dynamic value, [double fallback = 0]) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

int asInt(dynamic value, [int fallback = 0]) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

bool asBool(dynamic value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value.toLowerCase() == 'true' || value == '1';
  return fallback;
}
