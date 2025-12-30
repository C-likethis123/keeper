import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

class InlineMath extends StatelessWidget {
  final String latex;
  final TextStyle style;

  const InlineMath({
    super.key,
    required this.latex,
    required this.style,
  });

  @override
  Widget build(BuildContext context) {
    return Math.tex(
      latex,
      mathStyle: MathStyle.text,
      textStyle: style.copyWith(
        height: 1.2,
      ),
    );
  }
}
