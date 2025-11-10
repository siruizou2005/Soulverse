from .BaseLLM import BaseLLM
from openai import OpenAI
import os

class DeepSeek(BaseLLM):
    
    def __init__(self, model="deepseek-chat"):
        super(DeepSeek, self).__init__()
        api_base = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1").rstrip("/")
        self.client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url=api_base,
        )
        self.model_name = model
        self.messages = []


    def initialize_message(self):
        self.messages = []

    def ai_message(self, payload):
        self.messages.append({"role": "ai", "content": payload})

    def system_message(self, payload):
        self.messages.append({"role": "system", "content": payload})

    def user_message(self, payload):
        self.messages.append({"role": "user", "content": payload})

    def get_response(self,temperature = 0.8):
    
        response = self.client.chat.completions.create(
        model=self.model_name,
        messages=self.messages,
        stream=False
)
        return response.choices[0].message.content
    
    def chat(self, text, temperature=0.8, **kwargs):
        self.initialize_message()
        self.user_message(text)
        response = self.get_response(temperature=temperature)
        return response
    
    def print_prompt(self):
        for message in self.messages:
            print(message)
