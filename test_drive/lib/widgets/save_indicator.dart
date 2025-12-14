import 'dart:async';
import 'package:flutter/material.dart';
import '../save_queue.dart';

class SaveIndicator extends StatefulWidget {
  final ValueNotifier<SaveState> saveState;
  final Duration savedDisplayDuration;
  final Duration errorDisplayDuration;

  const SaveIndicator({
    super.key,
    required this.saveState,
    this.savedDisplayDuration = const Duration(seconds: 2),
    this.errorDisplayDuration = const Duration(seconds: 5),
  });

  @override
  State<SaveIndicator> createState() => _SaveIndicatorState();
}

class _SaveIndicatorState extends State<SaveIndicator> {
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    widget.saveState.addListener(_onSaveStateChanged);
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    widget.saveState.removeListener(_onSaveStateChanged);
    super.dispose();
  }

  void _onSaveStateChanged() {
    final newState = widget.saveState.value;
    
    // Cancel any existing hide timer
    _hideTimer?.cancel();

    // Force rebuild
    if (mounted) {
      setState(() {});
    }

    // Schedule hide for saved and error states
    if (newState == SaveState.saved) {
      _hideTimer = Timer(widget.savedDisplayDuration, () {
        if (mounted) {
          widget.saveState.value = SaveState.idle;
        }
      });
    } else if (newState == SaveState.error) {
      _hideTimer = Timer(widget.errorDisplayDuration, () {
        if (mounted) {
          widget.saveState.value = SaveState.idle;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Read the current state directly from the ValueNotifier
    final state = widget.saveState.value;
    
    switch (state) {
      case SaveState.idle:
        return const SizedBox.shrink();
        
      case SaveState.saving:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 8,
          children: [
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            Text('Saving...', style: TextStyle(fontSize: 14)),
          ],
        );
        
      case SaveState.saved:
        return Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 4,
          children: [
            Icon(Icons.check_circle_outline, 
                 size: 16, 
                 color: Colors.green[700]),
            Text('Saved', 
                 style: TextStyle(fontSize: 14, color: Colors.green[700])),
          ],
        );
        
      case SaveState.error:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 4,
          children: [
            Icon(Icons.error_outline, size: 16, color: Colors.red),
            Text('Save failed', 
                 style: TextStyle(fontSize: 14, color: Colors.red)),
          ],
        );
    }
  }
}