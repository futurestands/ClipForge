/// Display helpers shared by the status, budget and studio screens.
class Formatters {
  const Formatters._();

  static String usd(double value) => '\$${value.toStringAsFixed(2)}';

  static String percent(double fraction) => '${(fraction * 100).toStringAsFixed(0)}%';

  static String relativeTime(int epochMillis) {
    final DateTime time = DateTime.fromMillisecondsSinceEpoch(epochMillis);
    final DateTime now = DateTime.now();
    final Duration delta = now.difference(time);
    if (delta.inSeconds < 60) return 'just now';
    if (delta.inMinutes < 60) return '${delta.inMinutes}m ago';
    if (delta.inHours < 24) return '${delta.inHours}h ago';
    return '${time.month}/${time.day} ${time.hour.toString().padLeft(2, '0')}:'
        '${time.minute.toString().padLeft(2, '0')}';
  }

  static String capabilityLabel(String id) {
    switch (id) {
      case 'script':
        return 'Script';
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'voice':
        return 'Voice';
      default:
        return id.isEmpty ? 'Unknown' : id[0].toUpperCase() + id.substring(1);
    }
  }
}
