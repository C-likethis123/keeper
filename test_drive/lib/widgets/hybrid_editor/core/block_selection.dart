import 'package:flutter/foundation.dart';

@immutable
class BlockSelection {
  final int start;
  final int end;

  const BlockSelection({
    required this.start,
    required this.end,
  });

  bool get isCollapsed => start == end;

  bool contains(int index) =>
      index >= start && index <= end;

  BlockSelection normalized() =>
      start <= end ? this : BlockSelection(start: end, end: start);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BlockSelection &&
          runtimeType == other.runtimeType &&
          start == other.start &&
          end == other.end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => 'BlockSelection($start → $end)';
}
