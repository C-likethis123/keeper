import 'dart:async';

import 'package:flutter/material.dart';

/// A widget that shows "Saved" with a checkmark, then auto-hides after a delay.
/// Listens to a [ValueNotifier] trigger - increments to the trigger value cause the indicator to show.
class SaveIndicator extends StatefulWidget {
  /// A notifier that triggers the indicator when its value changes
  final ValueNotifier<int> trigger;

  /// How long to show the indicator before hiding
  final Duration displayDuration;

  const SaveIndicator({
    super.key,
    required this.trigger,
    this.displayDuration = const Duration(seconds: 2),
  });

  @override
  State<SaveIndicator> createState() => _SaveIndicatorState();
}

class _SaveIndicatorState extends State<SaveIndicator> {
  bool _isVisible = false;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    widget.trigger.addListener(_onTrigger);
  }

  @override
  void didUpdateWidget(covariant SaveIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger != oldWidget.trigger) {
      oldWidget.trigger.removeListener(_onTrigger);
      widget.trigger.addListener(_onTrigger);
    }
  }

  @override
  void dispose() {
    widget.trigger.removeListener(_onTrigger);
    _hideTimer?.cancel();
    super.dispose();
  }

  void _onTrigger() {
    _hideTimer?.cancel();
    setState(() => _isVisible = true);
    _hideTimer = Timer(widget.displayDuration, () {
      if (mounted) {
        setState(() => _isVisible = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) {
      return const SizedBox.shrink();
    }

    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.check,
          size: 16,
          color: colorScheme.primary,
        ),
        const SizedBox(width: 8),
        Text(
          'Saved',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.primary,
              ),
        ),
      ],
    );
  }
}
