import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/json_cast.dart';
import 'catalog_model.dart';

class GatewayBudget {
  const GatewayBudget({
    required this.spent,
    required this.cap,
    required this.calls,
  });

  factory GatewayBudget.fromJson(Map<String, dynamic> json) => GatewayBudget(
        spent: asDouble(json['spent']),
        cap: asDouble(json['cap'], 2.5),
        calls: asInt(json['calls']),
      );

  final double spent;
  final double cap;
  final int calls;

  double get fraction => cap <= 0 ? 0 : (spent / cap).clamp(0.0, 1.0).toDouble();
  double get remaining => (cap - spent).clamp(0.0, double.infinity).toDouble();

  @override
  String toString() => 'GatewayBudget(${Formatters.usd(spent)} / ${Formatters.usd(cap)}, $calls calls)';
}

class ModelDefaults {
  const ModelDefaults({
    required this.scriptModel,
    required this.imageModel,
    required this.videoModel,
    required this.voiceModel,
  });

  factory ModelDefaults.fromJson(Map<String, dynamic> json) => ModelDefaults(
        scriptModel: asString(json['scriptModel']),
        imageModel: asString(json['imageModel']),
        videoModel: asString(json['videoModel']),
        voiceModel: asString(json['voiceModel']),
      );

  final String scriptModel;
  final String imageModel;
  final String videoModel;
  final String voiceModel;

  Map<String, String> toJson() => <String, String>{
        'scriptModel': scriptModel,
        'imageModel': imageModel,
        'videoModel': videoModel,
        'voiceModel': voiceModel,
      };

  ModelDefaults copyWith({
    String? scriptModel,
    String? imageModel,
    String? videoModel,
    String? voiceModel,
  }) =>
      ModelDefaults(
        scriptModel: scriptModel ?? this.scriptModel,
        imageModel: imageModel ?? this.imageModel,
        videoModel: videoModel ?? this.videoModel,
        voiceModel: voiceModel ?? this.voiceModel,
      );
}

class GatewayStatus {
  const GatewayStatus({
    required this.online,
    required this.providers,
    required this.labels,
    required this.budget,
    required this.version,
    required this.models,
    required this.defaults,
    required this.recent,
  });

  factory GatewayStatus.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawProviders = asMap(json['providers']);
    final Map<String, dynamic> rawLabels = asMap(json['labels']);
    return GatewayStatus(
      online: asBool(json['online']),
      providers: rawProviders.map((String k, dynamic v) => MapEntry<String, bool>(k, asBool(v))),
      labels: rawLabels.map((String k, dynamic v) => MapEntry<String, String>(k, asString(v))),
      budget: GatewayBudget.fromJson(asMap(json['budget'])),
      version: asString(json['version'], '—'),
      models: asMapList(json['models']).map(CatalogModel.fromJson).toList(),
      defaults: ModelDefaults.fromJson(asMap(json['defaults'])),
      recent: asMapList(json['recent']).map(LedgerEntry.fromJson).toList(),
    );
  }

  /// Used when the gateway cannot be reached at all.
  factory GatewayStatus.offline() => const GatewayStatus(
        online: false,
        providers: <String, bool>{},
        labels: <String, String>{},
        budget: GatewayBudget(spent: 0, cap: 0, calls: 0),
        version: '—',
        models: <CatalogModel>[],
        defaults: ModelDefaults(scriptModel: '', imageModel: '', videoModel: '', voiceModel: ''),
        recent: <LedgerEntry>[],
      );

  final bool online;
  final Map<String, bool> providers;
  final Map<String, String> labels;
  final GatewayBudget budget;
  final String version;
  final List<CatalogModel> models;
  final ModelDefaults defaults;
  final List<LedgerEntry> recent;

  static const List<String> capabilities = <String>['script', 'image', 'video', 'voice'];

  int get configuredCount => providers.values.where((bool v) => v).length;

  bool get allLocal => configuredCount == 0;

  bool isConfigured(String capability) => providers[capability] ?? false;

  String labelFor(String capability) =>
      labels[capability] ?? 'No provider — local fallback';
}
