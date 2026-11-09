package vn.edu.uit.careerhub.ai;

/** Model answer plus token usage (null when the provider does not report it). */
public record AiCompletion(String text, Integer promptTokens, Integer outputTokens) {}
