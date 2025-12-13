import 'package:flutter/material.dart';

class NoteContentField extends StatefulWidget {
  final String? initialValue;
  final ValueChanged<String>? onChanged;

  const NoteContentField({
    super.key,
    this.initialValue,
    this.onChanged,
  });

  @override
  State<NoteContentField> createState() => _NoteContentFieldState();
}

class _NoteContentFieldState extends State<NoteContentField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      maxLines: null,
      expands: true,
      textAlignVertical: TextAlignVertical.top,
      onChanged: widget.onChanged,
      style: Theme.of(context).textTheme.bodyLarge,
      decoration: const InputDecoration(
        hintText: 'Start writing...',
        border: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }
}

